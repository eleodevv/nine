import { fetch as fetchStream } from 'expo/fetch';

import type { Sesion } from './sesion';

export type Puerto = {
  puerto: number;
  pid: number;
  proceso: string;
};

export const PUERTO_POR_DEFECTO = 9009;
const TIEMPO_LIMITE = 5000;
const TIEMPO_ELEVACION = 130000;

/** El servidor respondió con un estado de error (incluye 401). */
export class ErrorApi extends Error {
  estado: number;

  constructor(estado: number, mensaje: string) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.estado = estado;
  }
}

/** No hubo forma de llegar al servidor (timeout, sin red...). */
export class ErrorRed extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ErrorRed';
  }
}

export const MENSAJE_SIN_CONEXION = 'No se pudo conectar. ¿Estás en la misma WiFi?';

async function pedir(url: string, opciones: RequestInit): Promise<Response> {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TIEMPO_LIMITE);
  try {
    return await fetch(url, { ...opciones, signal: controlador.signal });
  } catch {
    throw new ErrorRed(MENSAJE_SIN_CONEXION);
  } finally {
    clearTimeout(temporizador);
  }
}

function base(host: string, port: number, ruta: string): string {
  return `http://${host}:${port}${ruta}`;
}

export async function emparejar(host: string, port: number, codigo: string): Promise<string> {
  const respuesta = await pedir(base(host, port, '/emparejar'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ codigo }),
  });

  if (respuesta.status === 401) {
    throw new ErrorApi(401, 'Código inválido o expirado');
  }
  if (!respuesta.ok) {
    throw new ErrorApi(respuesta.status, 'No se pudo emparejar la laptop');
  }

  const datos = (await respuesta.json()) as { token_dispositivo?: string };
  if (!datos.token_dispositivo) {
    throw new ErrorApi(respuesta.status, 'Respuesta inválida del servidor');
  }
  return datos.token_dispositivo;
}

export async function listarPuertos(sesion: Sesion): Promise<Puerto[]> {
  const respuesta = await pedir(base(sesion.host, sesion.port, '/puertos'), {
    headers: { Authorization: `Bearer ${sesion.token}` },
  });

  if (respuesta.status === 401) {
    throw new ErrorApi(401, 'no autorizado');
  }
  if (!respuesta.ok) {
    throw new ErrorApi(respuesta.status, 'No se pudieron leer los puertos');
  }
  return (await respuesta.json()) as Puerto[];
}

export async function matarPuerto(sesion: Sesion, puerto: number): Promise<void> {
  const respuesta = await pedir(base(sesion.host, sesion.port, `/puertos/${puerto}/matar`), {
    method: 'POST',
    headers: { Authorization: `Bearer ${sesion.token}` },
  });

  if (respuesta.status === 401) {
    throw new ErrorApi(401, 'no autorizado');
  }
  if (!respuesta.ok) {
    let mensaje = 'No se pudo matar el proceso';
    try {
      const datos = (await respuesta.json()) as { error?: string };
      if (datos.error) {
        mensaje = datos.error;
      }
    } catch {
      // Se conserva el mensaje genérico.
    }
    throw new ErrorApi(respuesta.status, mensaje);
  }
}

/** Termina el proceso del puerto pidiendo contraseña en la laptop. */
export async function matarPuertoElevado(sesion: Sesion, puerto: number): Promise<void> {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TIEMPO_ELEVACION);
  try {
    const respuesta = await fetch(base(sesion.host, sesion.port, `/puertos/${puerto}/matar-elevado`), {
      method: 'POST',
      headers: { Authorization: `Bearer ${sesion.token}` },
      signal: controlador.signal,
    });

    if (respuesta.status === 401) {
      throw new ErrorApi(401, 'no autorizado');
    }
    if (!respuesta.ok) {
      let mensaje = 'No se pudo elevar privilegios';
      try {
        const datos = (await respuesta.json()) as { error?: string };
        if (datos.error) {
          mensaje = datos.error;
        }
      } catch {
        // Se conserva el mensaje genérico.
      }
      throw new ErrorApi(respuesta.status, mensaje);
    }
  } catch (e) {
    if (e instanceof ErrorApi) {
      throw e;
    }
    if (controlador.signal.aborted) {
      throw new ErrorRed('Se agotó el tiempo esperando la contraseña en la laptop');
    }
    throw new ErrorRed(MENSAJE_SIN_CONEXION);
  } finally {
    clearTimeout(temporizador);
  }
}

export type Estado = { elevado: boolean; soportado: boolean };

/** Obtiene si la laptop tiene privilegios elevados. */
export async function obtenerEstado(sesion: Sesion): Promise<Estado> {
  const respuesta = await pedir(base(sesion.host, sesion.port, '/estado'), {
    headers: { Authorization: `Bearer ${sesion.token}` },
  });
  if (respuesta.status === 401) {
    throw new ErrorApi(401, 'no autorizado');
  }
  if (!respuesta.ok) {
    throw new ErrorApi(respuesta.status, 'No se pudo obtener el estado');
  }
  return (await respuesta.json()) as Estado;
}

/** Pide la contraseña en la laptop y eleva privilegios (una sola vez). */
export async function elevar(sesion: Sesion): Promise<void> {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TIEMPO_ELEVACION);
  try {
    const respuesta = await fetch(base(sesion.host, sesion.port, '/elevar'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${sesion.token}` },
      signal: controlador.signal,
    });

    if (respuesta.status === 401) {
      throw new ErrorApi(401, 'no autorizado');
    }
    if (!respuesta.ok) {
      let mensaje = 'No se pudo elevar privilegios';
      try {
        const datos = (await respuesta.json()) as { error?: string };
        if (datos.error) {
          mensaje = datos.error;
        }
      } catch {
        // Se conserva el mensaje genérico.
      }
      throw new ErrorApi(respuesta.status, mensaje);
    }
  } catch (e) {
    if (e instanceof ErrorApi) {
      throw e;
    }
    if (controlador.signal.aborted) {
      throw new ErrorRed('Se agotó el tiempo esperando la contraseña en la laptop');
    }
    throw new ErrorRed(MENSAJE_SIN_CONEXION);
  } finally {
    clearTimeout(temporizador);
  }
}

/** Lanza un servidor de desarrollo en un puerto (requiere privilegios). */
export async function lanzar(sesion: Sesion, tipo: string, puerto: number): Promise<number> {
  const respuesta = await pedir(base(sesion.host, sesion.port, '/lanzar'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sesion.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ tipo, puerto }),
  });

  if (respuesta.status === 401) {
    throw new ErrorApi(401, 'no autorizado');
  }
  if (!respuesta.ok) {
    let mensaje = 'No se pudo lanzar el servidor';
    try {
      const datos = (await respuesta.json()) as { error?: string };
      if (datos.error) {
        mensaje = datos.error;
      }
    } catch {
      // Se conserva el mensaje genérico.
    }
    throw new ErrorApi(respuesta.status, mensaje);
  }
  const datos = (await respuesta.json()) as { pid?: number };
  return datos.pid ?? 0;
}

function parsearBloque(bloque: string): { evento: string; datos: string } {
  let evento = '';
  let datos = '';
  for (const linea of bloque.split('\n')) {
    if (linea.startsWith('event:')) {
      evento = linea.slice(6).trim();
    } else if (linea.startsWith('data:')) {
      datos += linea.slice(5).trim();
    }
  }
  return { evento, datos };
}

export type FinStream = 'cerrar' | 'fin' | 'abortado';

/**
 * Se conecta a GET /eventos (Server-Sent Events) y llama a `alRecibir` con la
 * lista de puertos cada vez que cambia. Resuelve indicando por qué terminó.
 */
export async function escucharPuertos(
  sesion: Sesion,
  alRecibir: (puertos: Puerto[]) => void,
  signal: AbortSignal,
): Promise<FinStream> {
  let respuesta: Response;
  try {
    respuesta = await fetchStream(base(sesion.host, sesion.port, '/eventos'), {
      headers: {
        Authorization: `Bearer ${sesion.token}`,
        Accept: 'text/event-stream',
      },
      signal,
    });
  } catch {
    if (signal.aborted) {
      return 'abortado';
    }
    throw new ErrorRed(MENSAJE_SIN_CONEXION);
  }

  if (respuesta.status === 401) {
    throw new ErrorApi(401, 'no autorizado');
  }
  if (!respuesta.ok || !respuesta.body) {
    throw new ErrorApi(respuesta.status, 'No se pudo abrir el canal de eventos');
  }

  const lector = respuesta.body.getReader();
  const decodificador = new TextDecoder();
  let buffer = '';

  try {
    for (;;) {
      const { value, done } = await lector.read();
      if (done) {
        return 'fin';
      }
      buffer += decodificador.decode(value, { stream: true });

      let corte = buffer.indexOf('\n\n');
      while (corte !== -1) {
        const bloque = buffer.slice(0, corte);
        buffer = buffer.slice(corte + 2);

        const { evento, datos } = parsearBloque(bloque);
        if (evento === 'cerrar') {
          return 'cerrar';
        }
        if (datos) {
          try {
            alRecibir(JSON.parse(datos) as Puerto[]);
          } catch {
            // Evento no válido: se ignora.
          }
        }
        corte = buffer.indexOf('\n\n');
      }
    }
  } catch (e) {
    if (signal.aborted) {
      return 'abortado';
    }
    throw e;
  }
}
