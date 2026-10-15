import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BotonGlass } from '../componentes/BotonGlass';
import { FilaPuerto } from '../componentes/FilaPuerto';
import { HojaConfirmar } from '../componentes/HojaConfirmar';
import { IconoPerfil, IconoRefrescar } from '../componentes/iconos';
import {
  ErrorApi,
  escucharPuertos,
  listarPuertos,
  matarPuerto,
  matarPuertoElevado,
  type Puerto,
} from '../lib/api';
import { borrarSesion, leerSesion, type Sesion } from '../lib/sesion';
import { colores } from '../lib/tema';

const AVISO_REINICIO = 'La laptop se reinició. Vuelve a vincularla.';

function iguales(a: Puerto[], b: Puerto[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i += 1) {
    if (a[i].puerto !== b[i].puerto || a[i].pid !== b[i].pid || a[i].proceso !== b[i].proceso) {
      return false;
    }
  }
  return true;
}

export default function Puertos() {
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [puertos, setPuertos] = useState<Puerto[]>([]);
  const [cargandoInicial, setCargandoInicial] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [conectado, setConectado] = useState(true);
  const [aviso, setAviso] = useState('');
  const [matando, setMatando] = useState<Puerto | null>(null);
  const [elevando, setElevando] = useState<Puerto | null>(null);
  const [elevandoEnCurso, setElevandoEnCurso] = useState(false);
  const [saliendo, setSaliendo] = useState<number | null>(null);
  const [desvincularVisible, setDesvincularVisible] = useState(false);

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
    })();
    return () => {
      activo = false;
    };
  }, []);

  const reiniciar = useCallback(async (mensaje: string = AVISO_REINICIO) => {
    await borrarSesion();
    router.replace({ pathname: '/', params: { aviso: mensaje } });
  }, []);

  const cargar = useCallback(
    async (silencioso = false) => {
      if (!sesion) {
        return;
      }
      if (!silencioso) {
        setRefrescando(true);
      }
      try {
        const lista = await listarPuertos(sesion);
        setConectado(true);
        setAviso('');
        setPuertos((previos) => (iguales(previos, lista) ? previos : lista));
      } catch (e) {
        if (e instanceof ErrorApi && e.estado === 401) {
          await reiniciar();
          return;
        }
        setConectado(false);
      } finally {
        setCargandoInicial(false);
        setRefrescando(false);
      }
    },
    [sesion, reiniciar],
  );

  // Tiempo real: un stream SSE (GET /eventos) empuja la lista cuando cambia.
  // Si la terminal se cierra o se genera un código nuevo, la app se desconecta.
  useFocusEffect(
    useCallback(() => {
      if (!sesion) {
        return;
      }
      const controlador = new AbortController();
      let activo = true;
      let temporizador: ReturnType<typeof setTimeout> | null = null;
      let fallos = 0;

      const aplicar = (lista: Puerto[]) => {
        fallos = 0;
        setConectado(true);
        setAviso('');
        setCargandoInicial(false);
        setPuertos((previos) => (iguales(previos, lista) ? previos : lista));
      };

      const conectar = async () => {
        if (!activo) {
          return;
        }
        try {
          const fin = await escucharPuertos(sesion, aplicar, controlador.signal);
          if (fin === 'abortado') {
            return;
          }
          if (fin === 'cerrar') {
            await reiniciar('Se generó un código nuevo en la laptop. Vuelve a vincularla.');
            return;
          }
          // 'fin': el servidor cerró el stream (¿terminal cerrada?).
          fallos += 1;
        } catch (e) {
          if (e instanceof ErrorApi && e.estado === 401) {
            await reiniciar();
            return;
          }
          setConectado(false);
          cargar(true); // respaldo: una lectura puntual
          fallos += 1;
        }

        if (!activo) {
          return;
        }
        if (fallos >= 2) {
          await reiniciar('La laptop se desconectó. Vuelve a vincularla.');
          return;
        }
        temporizador = setTimeout(conectar, 3000);
      };

      conectar();

      return () => {
        activo = false;
        if (temporizador) {
          clearTimeout(temporizador);
        }
        controlador.abort();
      };
    }, [sesion, reiniciar, cargar]),
  );

  const confirmarMatar = async () => {
    const objetivo = matando;
    setMatando(null);
    if (!objetivo || !sesion) {
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await matarPuerto(sesion, objetivo.puerto);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSaliendo(objetivo.puerto);
      cargar(true);
    } catch (e) {
      if (e instanceof ErrorApi && e.estado === 401) {
        await reiniciar();
        return;
      }
      setAviso(e instanceof Error ? e.message : 'No se pudo matar el proceso');
      cargar(true);
    }
  };

  const alTerminarSalida = useCallback((numero: number) => {
    setPuertos((previos) => previos.filter((p) => p.puerto !== numero));
    setSaliendo(null);
  }, []);

  const confirmarElevar = async () => {
    const objetivo = elevando;
    if (!objetivo || !sesion) {
      return;
    }
    setElevandoEnCurso(true);
    try {
      await matarPuertoElevado(sesion, objetivo.puerto);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setElevando(null);
      setSaliendo(objetivo.puerto);
      cargar(true);
    } catch (e) {
      if (e instanceof ErrorApi && e.estado === 401) {
        await reiniciar();
        return;
      }
      setAviso(e instanceof Error ? e.message : 'No se pudo elevar privilegios');
      setElevando(null);
    } finally {
      setElevandoEnCurso(false);
    }
  };

  const confirmarDesvincular = async () => {
    setDesvincularVisible(false);
    await borrarSesion();
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.pantalla} edges={['top']}>
      <View style={styles.cabecera}>
        <View style={styles.estadoFila}>
          <View
            style={[styles.punto, { backgroundColor: conectado ? colores.exito : colores.peligro }]}
          />
          <Text style={styles.estadoTexto}>{conectado ? 'Mi laptop' : 'Sin conexión'}</Text>
        </View>

        <BotonGlass
          onPress={() => cargar()}
          etiqueta="Refrescar puertos"
          size={44}
          borde="rgba(255,255,255,0.18)"
          fondo="rgba(255,255,255,0.08)"
        >
          <IconoRefrescar tamano={20} />
        </BotonGlass>
      </View>

      <Pressable onLongPress={() => setDesvincularVisible(true)} delayLongPress={450}>
        <Text style={styles.titulo}>Puertos</Text>
      </Pressable>

      {aviso ? <Text style={styles.aviso}>{aviso}</Text> : null}

      <FlatList
        data={puertos}
        keyExtractor={(p) => String(p.puerto)}
        extraData={saliendo}
        renderItem={({ item }) => (
          <FilaPuerto
            puerto={item}
            alMatar={setMatando}
            alElevar={setElevando}
            saliendo={saliendo === item.puerto}
            alTerminarSalida={alTerminarSalida}
          />
        )}
        ListEmptyComponent={
          cargandoInicial ? (
            <View style={styles.vacioContenedor}>
              <ActivityIndicator color={colores.texto2} />
            </View>
          ) : (
            <View style={styles.vacioContenedor}>
              <Text style={styles.vacioTexto}>No hay puertos en escucha</Text>
            </View>
          )
        }
        ListFooterComponent={<View style={styles.lineaFinal} />}
        refreshControl={
          <RefreshControl
            refreshing={refrescando}
            onRefresh={() => cargar()}
            tintColor={colores.texto2}
            colors={[colores.texto2]}
            progressBackgroundColor={colores.fondo}
          />
        }
        showsVerticalScrollIndicator={false}
      />

      <HojaConfirmar
        visible={matando !== null}
        titulo={matando ? `¿Matar ${matando.proceso} en el puerto ${matando.puerto}?` : ''}
        subtitulo={matando && matando.pid > 0 ? `Se cerrará el proceso (PID ${matando.pid})` : undefined}
        textoConfirmar="Matar"
        alConfirmar={confirmarMatar}
        alCancelar={() => setMatando(null)}
      />

      <HojaConfirmar
        visible={elevando !== null}
        titulo={elevando ? `Elevar privilegios para el puerto ${elevando.puerto}` : ''}
        subtitulo="Aparecerá el diálogo de contraseña en tu laptop."
        textoConfirmar="Elevar"
        cargando={elevandoEnCurso}
        textoCargando="Esperando contraseña en la laptop…"
        alConfirmar={confirmarElevar}
        alCancelar={() => setElevando(null)}
      />

      <HojaConfirmar
        visible={desvincularVisible}
        titulo="¿Desvincular laptop?"
        subtitulo="Tendrás que volver a escanear el QR o escribir el código."
        textoConfirmar="Desvincular"
        alConfirmar={confirmarDesvincular}
        alCancelar={() => setDesvincularVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: colores.fondo,
    paddingHorizontal: 28,
    paddingTop: 64,
  },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    fontSize: 14,
    color: colores.texto2,
  },
  titulo: {
    fontSize: 40,
    fontWeight: '700',
    letterSpacing: -1.5,
    color: colores.texto,
    marginTop: 24,
    marginBottom: 24,
  },
  aviso: {
    fontSize: 14,
    color: colores.peligro,
    marginBottom: 16,
  },
  vacioContenedor: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  vacioTexto: {
    fontSize: 15,
    color: colores.texto3,
  },
  lineaFinal: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colores.linea2,
  },
});
