import { BlurView } from 'expo-blur';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colores, medidas, TACTIL } from '../lib/tema';

type Props = {
  visible: boolean;
  titulo: string;
  subtitulo?: string;
  textoConfirmar: string;
  textoCancelar?: string;
  peligro?: boolean;
  cargando?: boolean;
  textoCargando?: string;
  alConfirmar: () => void;
  alCancelar: () => void;
};

/** Hoja inferior de confirmación. */
export function HojaConfirmar({
  visible,
  titulo,
  subtitulo,
  textoConfirmar,
  textoCancelar = 'Cancelar',
  peligro = true,
  cargando = false,
  textoCargando,
  alConfirmar,
  alCancelar,
}: Props) {
  const cancelar = () => {
    if (!cargando) {
      alCancelar();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={cancelar}>
      <Pressable style={styles.fondo} onPress={cancelar}>
        <Pressable style={styles.hoja} onPress={() => {}}>
          <BlurView intensity={40} tint="dark" style={styles.blur} />
          <Text style={styles.titulo}>{titulo}</Text>
          {subtitulo ? <Text style={styles.subtitulo}>{subtitulo}</Text> : null}

          <Pressable
            onPress={alConfirmar}
            disabled={cargando}
            accessibilityRole="button"
            accessibilityLabel={textoConfirmar}
            style={({ pressed }) => [
              styles.botonConfirmar,
              peligro ? styles.botonPeligro : styles.botonNormal,
              pressed && !cargando && styles.pulsado,
            ]}
          >
            {cargando ? (
              <View style={styles.filaCargando}>
                <ActivityIndicator color={colores.fondo} />
                {textoCargando ? <Text style={styles.textoCargando}>{textoCargando}</Text> : null}
              </View>
            ) : (
              <Text style={[styles.textoConfirmar, peligro ? styles.textoPeligro : styles.textoNormal]}>
                {textoConfirmar}
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={cancelar}
            disabled={cargando}
            accessibilityRole="button"
            accessibilityLabel={textoCancelar}
            style={({ pressed }) => [
              styles.botonCancelar,
              pressed && !cargando && styles.pulsado,
              cargando && styles.deshabilitado,
            ]}
          >
            <Text style={styles.textoCancelar}>{textoCancelar}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fondo: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  hoja: {
    borderTopLeftRadius: medidas.radio,
    borderTopRightRadius: medidas.radio,
    overflow: 'hidden',
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 40,
    backgroundColor: 'rgba(14,14,18,0.72)',
  },
  blur: {
    ...StyleSheet.absoluteFill,
  },
  titulo: {
    fontSize: 20,
    fontWeight: '600',
    color: colores.texto,
  },
  subtitulo: {
    fontSize: 14,
    color: colores.texto3,
    marginTop: 6,
  },
  botonConfirmar: {
    height: medidas.tactil,
    borderRadius: medidas.radioPrincipal,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  botonPeligro: {
    backgroundColor: colores.peligro,
  },
  botonNormal: {
    backgroundColor: colores.texto,
  },
  filaCargando: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  textoCargando: {
    fontSize: 16,
    fontWeight: '600',
    color: colores.fondo,
  },
  textoConfirmar: {
    fontSize: 17,
    fontWeight: '600',
  },
  textoPeligro: {
    color: colores.fondo,
  },
  textoNormal: {
    color: colores.fondo,
  },
  botonCancelar: {
    height: TACTIL,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  textoCancelar: {
    fontSize: 17,
    fontWeight: '500',
    color: colores.texto2,
  },
  pulsado: {
    opacity: 0.75,
  },
  deshabilitado: {
    opacity: 0.4,
  },
});
