import * as SecureStore from 'expo-secure-store';

export type Sesion = {
  host: string;
  port: number;
  token: string;
};

const CLAVE_SESION = 'nine.sesion';
const CLAVE_IP = 'nine.ultimaIp';

export async function guardarSesion(sesion: Sesion): Promise<void> {
  await SecureStore.setItemAsync(CLAVE_SESION, JSON.stringify(sesion));
}

export async function leerSesion(): Promise<Sesion | null> {
  const crudo = await SecureStore.getItemAsync(CLAVE_SESION);
  if (!crudo) {
    return null;
  }
  try {
    const datos = JSON.parse(crudo) as Partial<Sesion>;
    if (typeof datos.host === 'string' && typeof datos.token === 'string' && typeof datos.port === 'number') {
      return { host: datos.host, port: datos.port, token: datos.token };
    }
  } catch {
    // Dato corrupto: se ignora.
  }
  return null;
}

export async function borrarSesion(): Promise<void> {
  await SecureStore.deleteItemAsync(CLAVE_SESION);
}

export async function guardarUltimaIp(ip: string): Promise<void> {
  await SecureStore.setItemAsync(CLAVE_IP, ip);
}

export async function leerUltimaIp(): Promise<string> {
  const ip = await SecureStore.getItemAsync(CLAVE_IP);
  return ip ?? '';
}
