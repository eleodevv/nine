import Svg, { Path } from 'react-native-svg';

import { colores } from '../lib/tema';

type Props = {
  tamano?: number;
  color?: string;
};

/** Icono de línea "+". */
export function IconoMas({ tamano = 30, color = colores.texto }: Props) {
  return (
    <Svg width={tamano} height={tamano} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 5 V19 M5 12 H19"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Icono de línea "refrescar". */
export function IconoRefrescar({ tamano = 22, color = colores.texto }: Props) {
  return (
    <Svg width={tamano} height={tamano} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20 12 a8 8 0 1 1 -2.6 -5.9"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      <Path
        d="M20 4 V11 H13"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Icono de línea "perfil". */
export function IconoPerfil({ tamano = 22, color = colores.texto }: Props) {
  return (
    <Svg width={tamano} height={tamano} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 12 a4 4 0 1 0 0 -8 a4 4 0 0 0 0 8 Z"
        stroke={color}
        strokeWidth={1.8}
      />
      <Path
        d="M5 20 c0 -3.6 3.1 -6 7 -6 s7 2.4 7 6"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Icono de línea "volver". */
export function IconoVolver({ tamano = 22, color = colores.texto }: Props) {
  return (
    <Svg width={tamano} height={tamano} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 5 L8 12 L15 19"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
