import { StyleSheet, Text, TextInput, View } from 'react-native';

import { colores } from '../lib/tema';

const DIGITOS = 6;

type Props = {
  valor: string;
  alCambiar: (valor: string) => void;
  autoFocus?: boolean;
};

function colorLinea(indice: number, llenos: number): string {
  if (indice < llenos) {
    return colores.texto;
  }
  if (indice === llenos) {
    return colores.acento;
  }
  return colores.vacio;
}

/** Seis dígitos dibujados sobre líneas, con un único campo oculto detrás. */
export function CodigoSeisDigitos({ valor, alCambiar, autoFocus = false }: Props) {
  const manejar = (texto: string) => {
    alCambiar(texto.replace(/[^0-9]/g, '').slice(0, DIGITOS));
  };

  return (
    <View style={styles.fila}>
      {Array.from({ length: DIGITOS }).map((_, indice) => (
        <View key={indice} style={[styles.celda, indice === 3 && styles.separacion]}>
          <Text style={styles.digito} allowFontScaling={false}>
            {valor[indice] ?? ''}
          </Text>
          <View style={[styles.linea, { backgroundColor: colorLinea(indice, valor.length) }]} />
        </View>
      ))}

      <TextInput
        value={valor}
        onChangeText={manejar}
        keyboardType="number-pad"
        maxLength={DIGITOS}
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        autoFocus={autoFocus}
        caretHidden
        style={styles.input}
        accessibilityLabel="Código de emparejamiento"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  celda: {
    width: 40,
    alignItems: 'center',
  },
  separacion: {
    marginLeft: 12,
  },
  digito: {
    height: 52,
    fontSize: 34,
    fontWeight: '600',
    color: colores.texto,
    textAlign: 'center',
    lineHeight: 52,
  },
  linea: {
    width: 40,
    height: 2,
    borderRadius: 1,
  },
  input: {
    ...StyleSheet.absoluteFill,
    color: 'transparent',
    backgroundColor: 'transparent',
  },
});
