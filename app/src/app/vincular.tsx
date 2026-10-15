import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CodigoSeisDigitos } from '../componentes/CodigoSeisDigitos';
import { EsquinasVisor } from '../componentes/EsquinasVisor';
import { ErrorApi, ErrorRed, PUERTO_POR_DEFECTO, emparejar } from '../lib/api';
import { guardarSesion, guardarUltimaIp, leerUltimaIp } from '../lib/sesion';
import { colores, medidas, TACTIL } from '../lib/tema';

const DURACION = 120; // segundos

type Destino = { host: string; port: number };

/** Acepta "ip" o "ip:puerto". El puerto por defecto es 9009. */
function parsearDestino(entrada: string): Destino | null {
  const texto = entrada.trim();
  if (!texto) {
    return null;
  }
  const [host, puertoTexto] = texto.split(':');
  const limpio = host?.trim();
  if (!limpio) {
    return null;
  }
  const port = puertoTexto ? Number(puertoTexto.trim()) : PUERTO_POR_DEFECTO;
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    return null;
  }
  return { host: limpio, port };
}

/** Valida el JSON del QR: {"host","port","token"}. */
function parsearQR(datos: string): { host: string; port: number; token: string } | null {
  let objeto: unknown;
  try {
    objeto = JSON.parse(datos);
  } catch {
    return null;
  }
  if (typeof objeto !== 'object' || objeto === null) {
    return null;
  }
  const o = objeto as Record<string, unknown>;
  if (typeof o.host !== 'string' || !o.host || typeof o.token !== 'string' || !o.token) {
    return null;
  }
  const port = typeof o.port === 'number' ? o.port : PUERTO_POR_DEFECTO;
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    return null;
  }
  return { host: o.host, port, token: o.token };
}

function formatearCuenta(segundos: number): string {
  const minutos = Math.floor(segundos / 60);
  const resto = segundos % 60;
  return `${minutos}:${String(resto).padStart(2, '0')}`;
}

export default function Vincular() {
  const [permiso, pedirPermiso] = useCameraPermissions();
  const [codigo, setCodigo] = useState('');
  const [ip, setIp] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [restante, setRestante] = useState(DURACION);

  const procesado = useRef(false);
  const expirado = restante === 0;
  const destino = parsearDestino(ip);
  const puedeVincular = codigo.length === 6 && destino !== null && !cargando && !expirado;

  useEffect(() => {
    const id = setInterval(() => {
      setRestante((r) => (r <= 1 ? 0 : r - 1));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    leerUltimaIp().then((valor) => {
      if (valor) {
        setIp(valor);
      }
    });
  }, []);

  const enlazar = async (host: string, port: number, entrada: string, ipRecordada: string) => {
    setError('');
    setCargando(true);
    try {
      const token = await emparejar(host, port, entrada);
      await guardarSesion({ host, port, token });
      await guardarUltimaIp(ipRecordada);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/puertos');
    } catch (e) {
      procesado.current = false;
      if (e instanceof ErrorApi && e.estado === 401) {
        setError('Código inválido o expirado');
      } else if (e instanceof ErrorRed) {
        setError(e.message);
      } else {
        setError('Ocurrió un error inesperado');
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setCargando(false);
    }
  };

  const manejarQR = (datos: string) => {
    if (procesado.current || cargando) {
      return;
    }
    const qr = parsearQR(datos);
    if (!qr) {
      return; // Ignoramos QR que no sean de Nine.
    }
    procesado.current = true;
    enlazar(qr.host, qr.port, qr.token, qr.host);
  };

  const vincularManual = () => {
    if (!puedeVincular || !destino) {
      return;
    }
    Keyboard.dismiss();
    enlazar(destino.host, destino.port, codigo, ip.trim());
  };

  const textoCuenta = expirado
    ? 'El código expiró, genera otro en tu laptop'
    : `Expira en ${formatearCuenta(restante)}`;

  return (
    <SafeAreaView style={styles.pantalla} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.contenido}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable onPress={() => router.back()} style={styles.cancelar} accessibilityRole="button">
          <Text style={styles.cancelarTexto}>Cancelar</Text>
        </Pressable>

        <Text style={styles.titulo}>Vincular</Text>

        <View style={styles.visor}>
          {permiso?.granted ? (
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={(resultado) => manejarQR(resultado.data)}
            />
          ) : (
            <View style={styles.visorVacio}>
              <Text style={styles.permisoTexto}>
                {permiso ? 'Permite el acceso a la cámara' : 'Cargando cámara…'}
              </Text>
              {permiso && !permiso.granted ? (
                <Pressable
                  onPress={pedirPermiso}
                  style={({ pressed }) => [styles.botonPermiso, pressed && styles.pulsado]}
                >
                  <Text style={styles.botonPermisoTexto}>Permitir cámara</Text>
                </Pressable>
              ) : null}
            </View>
          )}
          <EsquinasVisor />
        </View>

        <View style={styles.separador}>
          <View style={styles.lineaSep} />
          <Text style={styles.textoSep}>o escribe el código</Text>
          <View style={styles.lineaSep} />
        </View>

        <CodigoSeisDigitos valor={codigo} alCambiar={setCodigo} />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.etiqueta}>IP de la laptop</Text>
        <TextInput
          value={ip}
          onChangeText={setIp}
          placeholder="192.168.1.20"
          placeholderTextColor={colores.vacio}
          keyboardType="decimal-pad"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.inputIp}
          accessibilityLabel="IP de la laptop"
        />

        <View style={styles.espacio} />

        <Pressable
          onPress={vincularManual}
          disabled={!puedeVincular}
          accessibilityRole="button"
          accessibilityLabel="Vincular"
          style={({ pressed }) => [
            styles.boton,
            !puedeVincular && styles.botonDeshabilitado,
            pressed && puedeVincular && styles.pulsado,
          ]}
        >
          {cargando ? (
            <ActivityIndicator color={colores.fondo} />
          ) : (
            <Text style={styles.botonTexto}>Vincular</Text>
          )}
        </Pressable>

        <Text style={styles.cuenta}>{textoCuenta}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: colores.fondo,
  },
  contenido: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingBottom: 24,
  },
  cancelar: {
    height: TACTIL,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  cancelarTexto: {
    fontSize: 17,
    color: colores.texto2,
  },
  titulo: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -1,
    color: colores.texto,
    marginTop: 8,
    marginBottom: 20,
  },
  visor: {
    width: '100%',
    height: 290,
    borderRadius: medidas.radio,
    borderWidth: 1,
    borderColor: colores.linea,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  visorVacio: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  permisoTexto: {
    fontSize: 15,
    color: colores.texto3,
    textAlign: 'center',
  },
  botonPermiso: {
    marginTop: 16,
    height: TACTIL,
    paddingHorizontal: 20,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colores.bordeGlass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botonPermisoTexto: {
    fontSize: 15,
    fontWeight: '600',
    color: colores.texto,
  },
  separador: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 24,
  },
  lineaSep: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colores.linea,
  },
  textoSep: {
    fontSize: 14,
    color: colores.texto3,
  },
  error: {
    fontSize: 14,
    color: colores.peligro,
    marginTop: 14,
  },
  etiqueta: {
    fontSize: 13,
    color: colores.texto3,
    marginTop: 28,
    marginBottom: 8,
  },
  inputIp: {
    fontSize: 18,
    color: colores.texto,
    paddingVertical: 8,
    borderBottomWidth: 2,
    borderBottomColor: colores.vacio,
  },
  espacio: {
    flex: 1,
    minHeight: 24,
  },
  boton: {
    height: medidas.tactil,
    borderRadius: medidas.radioPrincipal,
    backgroundColor: colores.texto,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  botonDeshabilitado: {
    opacity: 0.4,
  },
  botonTexto: {
    fontSize: 17,
    fontWeight: '600',
    color: colores.fondo,
  },
  cuenta: {
    fontSize: 13,
    color: colores.texto3,
    textAlign: 'center',
    marginTop: 16,
  },
  pulsado: {
    opacity: 0.75,
  },
});
