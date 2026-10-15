import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colores } from '../lib/tema';

const LADO = 38;
const TRAZO = 3;
const RADIO = 14;
const SEPARACION = 30;

/** Una esquina del visor, en forma de corchete con la esquina redondeada. */
function Esquina({ giro }: { giro: number }) {
  return (
    <View style={{ transform: [{ rotate: `${giro}deg` }] }}>
      <Svg width={LADO} height={LADO}>
        <Path
          d={`M ${LADO} 0 L ${RADIO} 0 Q 0 0 0 ${RADIO} L 0 ${LADO}`}
          stroke={colores.acento}
          strokeWidth={TRAZO}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
    </View>
  );
}

/** Cuatro esquinas que enmarcan la zona de escaneo. */
export function EsquinasVisor() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[styles.base, styles.arriba, styles.izquierda]}>
        <Esquina giro={0} />
      </View>
      <View style={[styles.base, styles.arriba, styles.derecha]}>
        <Esquina giro={90} />
      </View>
      <View style={[styles.base, styles.abajo, styles.derecha]}>
        <Esquina giro={180} />
      </View>
      <View style={[styles.base, styles.abajo, styles.izquierda]}>
        <Esquina giro={270} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    position: 'absolute',
  },
  arriba: {
    top: SEPARACION,
  },
  abajo: {
    bottom: SEPARACION,
  },
  izquierda: {
    left: SEPARACION,
  },
  derecha: {
    right: SEPARACION,
  },
});
