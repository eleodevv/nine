import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BotonGlass } from '../componentes/BotonGlass';
import { IconoMas } from '../componentes/iconos';
import { leerSesion } from '../lib/sesion';
import { colores } from '../lib/tema';

export default function Inicio() {
  const { aviso } = useLocalSearchParams<{ aviso?: string }>();
  const [listo, setListo] = useState(false);

  useEffect(() => {
    let activo = true;
    (async () => {
      const sesion = await leerSesion();
      if (!activo) {
        return;
      }
      if (sesion) {
        router.replace('/puertos');
        return;
      }
      setListo(true);
    })();
    return () => {
      activo = false;
    };
  }, []);

  const vincular = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/vincular');
  };

  if (!listo) {
    return (
      <SafeAreaView style={styles.pantalla}>
        <View style={styles.centro}>
          <ActivityIndicator color={colores.texto2} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.pantalla} edges={['top', 'bottom']}>
      <View style={styles.cuerpo}>
        <Text style={styles.marca} allowFontScaling={false} numberOfLines={1}>
          nine
        </Text>
        <View style={styles.botonCapa}>
          <BotonGlass onPress={vincular} etiqueta="Vincular una laptop" size={80}>
            <IconoMas tamano={30} />
          </BotonGlass>
        </View>
      </View>

      <View style={styles.pie}>
        {aviso ? <Text style={styles.aviso}>{aviso}</Text> : null}
        <Text style={styles.pista}>Toca + para vincular una laptop</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: colores.fondo,
  },
  centro: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cuerpo: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marca: {
    position: 'absolute',
    top: '26%',
    width: '100%',
    textAlign: 'center',
    fontSize: 156,
    fontWeight: '800',
    letterSpacing: -8,
    color: 'rgba(255,255,255,0.07)',
  },
  botonCapa: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pie: {
    paddingHorizontal: 28,
    paddingBottom: 24,
    alignItems: 'center',
  },
  aviso: {
    fontSize: 14,
    color: colores.peligro,
    textAlign: 'center',
    marginBottom: 12,
  },
  pista: {
    fontSize: 14,
    color: colores.texto3,
    textAlign: 'center',
  },
});
