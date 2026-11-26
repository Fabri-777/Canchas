const TIMEOUT_MS = 10_000;
const RETRY_DELAYS = [300, 600];
const OFFLINE_MESSAGE = 'No tienes conexión a internet. Vuelve a intentarlo cuando se restablezca.';
const TIMEOUT_MESSAGE = 'La solicitud tardó demasiado. Vuelve a intentarlo.';
const SERVICE_MESSAGE = 'El servicio no está disponible por el momento. Inténtalo en unos minutos.';

const fieldLabels = {
  name: 'Nombre', email: 'Correo electrónico', phone: 'Celular', password: 'Contraseña',
  court: 'Cancha', court_id: 'Cancha', date: 'Fecha', hour: 'Hora', method: 'Medio de pago',
  receipt: 'Comprobante', result: 'Resultado del pago', role: 'Tipo de cuenta', id: 'Identificador',
  sport: 'Deporte', description: 'Descripción', district: 'Distrito', price: 'Precio',
  capacity: 'Capacidad', opens_at: 'Apertura', closes_at: 'Cierre', active: 'Disponibilidad',
  reason: 'Motivo',
};

const validationMessages = {
  missing: 'completa este campo',
  string_too_short: 'el texto es demasiado corto',
  string_too_long: 'el texto es demasiado largo',
  string_pattern_mismatch: 'revisa el formato',
  int_parsing: 'ingresa un número entero',
  float_parsing: 'ingresa un número',
  date_parsing: 'ingresa una fecha válida',
  date_from_datetime_parsing: 'ingresa una fecha válida',
  literal_error: 'elige una opción válida',
  greater_than: 'el valor está por debajo del mínimo permitido',
  greater_than_equal: 'el valor está por debajo del mínimo permitido',
  less_than: 'el valor supera el máximo permitido',
  less_than_equal: 'el valor supera el máximo permitido',
};

export const apiEvents = new EventTarget();

class ApiError extends Error {
  constructor(message, { status, retryable = false } = {}) {
    super(message);
    this.status = status;
    this.retryable = retryable;
  }
}

function responseMessage(status, detail) {
  if (status === 503) return SERVICE_MESSAGE;
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const fields = detail.map(issue => {
      const key = Array.isArray(issue?.loc) ? issue.loc.at(-1) : null;
      const field = Object.hasOwn(fieldLabels, key) ? fieldLabels[key] : 'Datos de la solicitud';
      const type = issue?.type;
      const message = Object.hasOwn(validationMessages, type) ? validationMessages[type] : 'revisa el valor ingresado';
      return `${field}: ${message}.`;
    });
    return fields.length ? [...new Set(fields)].join(' ') : 'Revisa los datos ingresados.';
  }
  if (status === 401) return 'Ingresa a tu cuenta para continuar.';
  if (status === 403) return 'No tienes permiso para realizar esta acción.';
  return 'No pudimos completar la solicitud. Vuelve a intentarlo.';
}

async function request(path, options) {
  if (navigator.onLine === false) throw new ApiError(OFFLINE_MESSAGE);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`/api/${path}`, { ...options, signal: controller.signal });
    if (response.status === 401) apiEvents.dispatchEvent(new Event('unauthorized'));
    if (response.status === 204 || response.status === 205) return null;

    let data;
    try {
      data = await response.json();
    } catch (error) {
      if (response.ok || controller.signal.aborted) throw error;
    }

    if (!response.ok) {
      throw new ApiError(responseMessage(response.status, data?.detail), {
        status: response.status,
        retryable: response.status >= 500 && response.status <= 599,
      });
    }
    return data;
  } catch (error) {
    if (controller.signal.aborted) throw new ApiError(TIMEOUT_MESSAGE);
    if (error instanceof ApiError) throw error;
    if (navigator.onLine === false) throw new ApiError(OFFLINE_MESSAGE);
    if (error instanceof TypeError) {
      throw new ApiError('No pudimos conectar con el servidor. Vuelve a intentarlo.', { retryable: true });
    }
    throw new ApiError('La respuesta del servidor no se pudo leer. Vuelve a intentarlo.');
  } finally {
    clearTimeout(timeout);
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  const options = { method: method.toUpperCase(), credentials: 'same-origin' };
  if (options.method === 'GET') options.cache = 'no-store';
  if (body instanceof FormData) {
    options.body = body;
  } else if (body !== undefined) {
    options.headers = { 'Content-Type': 'application/json' };
    options.body = JSON.stringify(body);
  }

  let retries = 0;
  while (true) {
    try {
      return await request(path, options);
    } catch (error) {
      if (options.method !== 'GET' || !error.retryable || retries === RETRY_DELAYS.length) throw error;
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[retries]));
      retries++;
    }
  }
}
