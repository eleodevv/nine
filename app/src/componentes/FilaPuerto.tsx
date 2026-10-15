import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Puerto } from '../lib/api';
import { colores, TACTIL } from '../lib/tema';

type Props = {
  puerto: Puerto;
  alMatar: (puerto: Puerto) => void;
  alElevar: (puerto: Puerto) => void;
  saliendo: boolean;
  alTerminarSalida: (numero: number) => void;
};

export function FilaPuerto({ puerto, alMatar, alElevar, saliendo, alTerminarSalida }: Props) {
  const [opacidad] = useState(() => new Animated.Value(1));
  const [desplazar] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!saliendo) {
      return;
    }
    Animated.parallel([
      Animated.timing(opacidad, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(desplazar, { toValue: -16, duration: 200, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) {
        alTerminarSalida(puerto.puerto);
      }
    });
  }, [saliendo, opacidad, desplazar, alTerminarSalida, puerto.puerto]);

  const esNine = puerto.proceso === 'nine';
  const necesitaElevar = puerto.pid <= 0 && !esNine;
  const pidTexto = puerto.pid > 0 ? `PID ${puerto.pid}` : 'PID -';

  return (
    <Animated.View
      style={[styles.fila, { opacity: opacidad, transform: [{ translateX: desplazar }] }]}
    >
      <Text style={styles.numero} allowFontScaling={false} numberOfLines={1}>
        {puerto.puerto}
      </Text>

      <View style={styles.centro}>
        <Text style={styles.proceso} numberOfLines={1}>
          {puerto.proceso}
        </Text>
        <Text style={styles.pid} numberOfLines={1}>
          {pidTexto}
        </Text>
      </View>

      {esNine ? (
        <Text style={styles.enUso}>en uso</Text>
      ) : necesitaElevar ? (
        <Pressable
          onPress={() => alElevar(puerto)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Elevar privilegios para el puerto ${puerto.puerto}`}
          style={({ pressed }) => [styles.accion, pressed && styles.accionPulsada]}
        >
          <Text style={styles.elevar}>Elevar</Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={() => alMatar(puerto)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Matar ${puerto.proceso} en el puerto ${puerto.puerto}`}
          style={({ pressed }) => [styles.accion, pressed && styles.accionPulsada]}
        >
          <Text style={styles.matar}>Matar</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fila: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colores.linea2,
    backgroundColor: 'transparent',
  },
  numero: {
    width: 96,
    fontSize: 28,
    fontWeight: '600',
    letterSpacing: -1,
    color: colores.texto,
  },
  centro: {
    flex: 1,
    justifyContent: 'center',
  },
  proceso: {
    fontSize: 17,
    fontWeight: '500',
    color: colores.texto,
  },
  pid: {
    fontSize: 13,
    color: colores.texto3,
    marginTop: 2,
  },
  accion: {
    minHeight: TACTIL,
    justifyContent: 'center',
    paddingLeft: 16,
  },
  accionPulsada: {
    opacity: 0.6,
  },
  matar: {
    fontSize: 17,
    fontWeight: '600',
    color: colores.peligro,
  },
  elevar: {
    fontSize: 17,
    fontWeight: '600',
    color: colores.texto,
  },
  enUso: {
    fontSize: 14,
    color: colores.apagado,
    paddingLeft: 16,
  },
});
