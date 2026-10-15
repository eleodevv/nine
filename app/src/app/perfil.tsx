import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BotonGlass } from '../componentes/BotonGlass';
import { IconoVolver } from '../componentes/iconos';
import { ErrorApi, elevar, lanzar, obtenerEstado } from '../lib/api';
import { leerSesion, type Sesion } from '../lib/sesion';
import { colores, medidas, TACTIL } from '../lib/tema';

type Preset = 'python' | 'node';

const PRESETS: { id: Preset; etiqueta: string }[] = [
  { id: 'python', etiqueta: 'Python' },
  { id: 'node', etiqueta: 'Node' },
];

export default function Perfil() {
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [cargandoEstado, setCargandoEstado] = useState(true);
  const [elevado, setElevado] = useState(false);
  const [soportado, setSoportado] = useState(true);

  const [elevando, setElevando] = useState(false);
  const [preset, setPreset] = useState<Preset>('python');
  const [puerto, setPuerto] = useState('3000');
  const [lanzando, setLanzando] = useState(false);

  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let activo = true;
    (async () => {
      const guardada = await leerSesion();
      if (!activo) {
        return;
      }
      if (!guardada) {
        router.replace('/');
        return;
      }
      setSesion(guardada);
      try {
        const estado = await obtenerEstado(guardada);
        if (activo) {
          setElevado(estado.elevado);
          setSoportado(estado.soportado);
        }
      } catch (e) {
        if (e instanceof ErrorApi && e.estado === 401) {
          router.replace('/');
          return;
        }
        if (activo) {
          setError('No se pudo consultar el estado de la laptop');
        }
      } finally {
        if (activo) {
          setCargandoEstado(false);
        }
      }
    })();
    return () => {
      activo = false;
    };
  }, []);

  const solicitarElevacion = async () => {
    if (!sesion || elevando) {
      return;
    }
    setError('');
    setAviso('');
    setElevando(true);
    try {
      await elevar(sesion);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setElevado(true);
      setAviso('Privilegios elevados. Vuelve a Puertos para ver todos los procesos.');
    } catch (e) {
      if (e instanceof ErrorApi && e.estado === 401) {
        router.replace('/');
        return;
      }
      setError(e instanceof Error ? e.message : 'No se pudo elevar privilegios');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setElevando(false);
    }
  };

  const lanzarServidor = async () => {
    if (!sesion || lanzando) {
      return;
    }
    const numero = Number(puerto);
    if (!Number.isInteger(numero) || numero < 1 || numero > 65535) {
      setError('Puerto inválido');
      return;
    }
    setError('');
    setAviso('');
    setLanzando(true);
    try {
      await lanzar(sesion, preset, numero);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setAviso(`Servidor ${preset} escuchando en el puerto ${numero}`);
    } catch (e) {
      if (e instanceof ErrorApi && e.estado === 401) {
        router.replace('/');
        return;
      }
      setError(e instanceof Error ? e.message : 'No se pudo lanzar el servidor');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLanzando(false);
    }
  };

  const puedeLanzar = elevado && !lanzando;

  return (
    <SafeAreaView style={styles.pantalla} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.contenido}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.barraSuperior}>
          <BotonGlass
            onPress={() => router.back()}
            etiqueta="Volver"
            size={44}
            borde="rgba(255,255,255,0.18)"
            fondo="rgba(255,255,255,0.08)"
          >
            <IconoVolver tamano={20} />
          </BotonGlass>
        </View>

        <Text style={styles.titulo}>Perfil</Text>

        <View style={styles.tarjeta}>
          <Text style={styles.etiqueta}>PRIVILEGIOS</Text>

          {cargandoEstado ? (
            <ActivityIndicator color={colores.texto2} style={styles.cargando} />
          ) : (
            <>
              <View style={styles.estadoFila}>
                <View
                  style={[
                    styles.punto,
                    { backgroundColor: elevado ? colores.exito : colores.inactivo },
                  ]}
                />
                <Text style={styles.estadoTexto}>{elevado ? 'Elevados' : 'Sin elevar'}</Text>
              </View>

              <Text style={styles.descripcion}>
                {elevado
                  ? 'nine puede ver y controlar todos los puertos, incluidos los de root.'
                  : 'Autoriza con un diálogo de contraseña en tu laptop para ver y controlar todos los puertos.'}
              </Text>

              {!soportado ? (
                <Text style={styles.noSoportado}>No disponible en este sistema todavía.</Text>
              ) : !elevado ? (
                <Pressable
                  onPress={solicitarElevacion}
                  disabled={elevando}
                  accessibilityRole="button"
                  accessibilityLabel="Elevar privilegios"
                  style={({ pressed }) => [
                    styles.botonPrincipal,
                    pressed && !elevando && styles.pulsado,
                  ]}
                >
                  {elevando ? (
                    <View style={styles.filaCargando}>
                      <ActivityIndicator color={colores.fondo} />
                      <Text style={styles.textoBotonPrincipal}>Esperando contraseña en la laptop…</Text>
                    </View>
                  ) : (
                    <Text style={styles.textoBotonPrincipal}>Elevar privilegios</Text>
                  )}
                </Pressable>
              ) : null}
            </>
          )}
        </View>

        <Text style={styles.subtitulo}>Lanzar servidor</Text>

        <View style={styles.filaPresets}>
          {PRESETS.map((p) => {
            const activo = p.id === preset;
            return (
              <Pressable
                key={p.id}
                onPress={() => setPreset(p.id)}
                accessibilityRole="button"
                accessibilityLabel={`Preset ${p.etiqueta}`}
                style={[styles.chip, activo && styles.chipActivo]}
              >
                <Text style={[styles.chipTexto, activo && styles.chipTextoActivo]}>{p.etiqueta}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.etiqueta}>PUERTO</Text>
        <TextInput
          value={puerto}
          onChangeText={(t) => setPuerto(t.replace(/[^0-9]/g, '').slice(0, 5))}
          placeholder="3000"
          placeholderTextColor={colores.vacio}
          keyboardType="number-pad"
          style={styles.inputPuerto}
          accessibilityLabel="Puerto"
        />

        <Pressable
          onPress={lanzarServidor}
          disabled={!puedeLanzar}
          accessibilityRole="button"
          accessibilityLabel="Lanzar servidor"
          style={({ pressed }) => [
            styles.botonSecundario,
            !puedeLanzar && styles.deshabilitado,
            pressed && puedeLanzar && styles.pulsado,
          ]}
        >
          {lanzando ? (
            <ActivityIndicator color={colores.texto} />
          ) : (
            <Text style={styles.textoBotonSecundario}>Lanzar</Text>
          )}
        </Pressable>

        {!elevado && soportado ? (
          <Text style={styles.pista}>Primero eleva privilegios para poder lanzar.</Text>
        ) : null}

        {aviso ? <Text style={styles.avisoOk}>{aviso}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
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
    paddingHorizontal: 28,
    paddingBottom: 32,
  },
  barraSuperior: {
    flexDirection: 'row',
    marginTop: 8,
  },
  titulo: {
    fontSize: 40,
    fontWeight: '700',
    letterSpacing: -1.5,
    color: colores.texto,
    marginTop: 20,
    marginBottom: 24,
  },
  tarjeta: {
    borderWidth: 1,
    borderColor: colores.linea,
    borderRadius: medidas.radio,
    padding: 20,
  },
  etiqueta: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1,
    color: colores.texto2,
    marginBottom: 12,
  },
  cargando: {
    marginVertical: 16,
  },
  estadoFila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  punto: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  estadoTexto: {
    fontSize: 18,
    fontWeight: '600',
    color: colores.texto,
  },
  descripcion: {
    fontSize: 14,
    lineHeight: 20,
    color: colores.texto3,
    marginTop: 10,
  },
  noSoportado: {
    fontSize: 14,
    color: colores.aviso,
    marginTop: 14,
  },
  botonPrincipal: {
    height: medidas.tactil,
    borderRadius: medidas.radioPrincipal,
    backgroundColor: colores.texto,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  filaCargando: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
  },
  textoBotonPrincipal: {
    fontSize: 16,
    fontWeight: '600',
    color: colores.fondo,
  },
  subtitulo: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: colores.texto,
    marginTop: 32,
    marginBottom: 16,
  },
  filaPresets: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  chip: {
    minHeight: TACTIL,
    paddingHorizontal: 20,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colores.linea,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActivo: {
    borderColor: colores.texto,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  chipTexto: {
    fontSize: 16,
    fontWeight: '600',
    color: colores.texto2,
  },
  chipTextoActivo: {
    color: colores.texto,
  },
  inputPuerto: {
    fontSize: 20,
    color: colores.texto,
    paddingVertical: 8,
    borderBottomWidth: 2,
    borderBottomColor: colores.vacio,
    marginBottom: 24,
  },
  botonSecundario: {
    height: medidas.tactil,
    borderRadius: medidas.radioPrincipal,
    borderWidth: 1,
    borderColor: colores.bordeGlass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoBotonSecundario: {
    fontSize: 17,
    fontWeight: '600',
    color: colores.texto,
  },
  pista: {
    fontSize: 13,
    color: colores.texto3,
    marginTop: 12,
  },
  avisoOk: {
    fontSize: 14,
    color: colores.exito,
    marginTop: 18,
  },
  error: {
    fontSize: 14,
    color: colores.peligro,
    marginTop: 18,
  },
  pulsado: {
    opacity: 0.75,
  },
  deshabilitado: {
    opacity: 0.4,
  },
});
