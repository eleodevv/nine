import { StyleSheet } from 'react-native';

// Sistema de diseño de Nine. Solo tema oscuro.
export const colores = {
  fondo: '#08080B',
  texto: '#F5F5F7',
  texto2: 'rgba(245,245,247,0.6)',
  texto3: 'rgba(245,245,247,0.55)',
  apagado: 'rgba(245,245,247,0.5)',
  acento: '#6CB6FF',
  peligro: '#FF8A80',
  exito: '#5DDB8A',
  linea: 'rgba(255,255,255,0.1)',
  linea2: 'rgba(255,255,255,0.09)',
  vacio: 'rgba(255,255,255,0.2)',
  bordeGlass: 'rgba(255,255,255,0.2)',
  fondoGlass: 'rgba(255,255,255,0.1)',
  brilloGlass: 'rgba(255,255,255,0.3)',
} as const;

export const medidas = {
  radio: 28,
  radioPrincipal: 27,
  tactil: 54,
} as const;

// Alto mínimo táctil recomendado.
export const TACTIL = 44;

export const tipografia = StyleSheet.create({
  titulo: {
    fontSize: 40,
    fontWeight: '700',
    letterSpacing: -1.5,
    color: colores.texto,
  },
});
