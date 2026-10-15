import type { ReactNode } from 'react';
import { BlurView } from 'expo-blur';
import { Pressable, StyleSheet, View } from 'react-native';

import { colores } from '../lib/tema';

type Props = {
  onPress: () => void;
  etiqueta: string;
  children: ReactNode;
  size?: number;
  radio?: number;
  borde?: string;
  fondo?: string;
  atenuado?: boolean;
};

/**
 * Boton circular con efecto glass. Como el fondo de la app es plano, el
 * efecto lo aportan el borde y el relleno translucido, no el desenfoque.
 */
export function BotonGlass({
  onPress,
  etiqueta,
  children,
  size = 80,
  radio,
  borde = 'rgba(255,255,255,0.22)',
  fondo = 'rgba(255,255,255,0.12)',
  atenuado = false,
}: Props) {
  const r = radio ?? size / 2;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      hitSlop={8}
      style={({ pressed }) => [
        styles.contenedor,
        {
          width: size,
          height: size,
          borderRadius: r,
          borderColor: borde,
          backgroundColor: fondo,
        },
        pressed && styles.pulsado,
        atenuado && styles.atenuado,
      ]}
    >
      <BlurView intensity={40} tint="dark" style={[styles.blur, { borderRadius: r }]}>
        <View style={styles.capaBrillo} pointerEvents="none">
          <View style={styles.brillo} />
        </View>
        <View style={styles.centro}>{children}</View>
      </BlurView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  blur: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  capaBrillo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  brillo: {
    width: '46%',
    height: 1,
    borderRadius: 1,
    backgroundColor: colores.brilloGlass,
  },
  centro: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulsado: {
    opacity: 0.7,
  },
  atenuado: {
    opacity: 0.5,
  },
});
