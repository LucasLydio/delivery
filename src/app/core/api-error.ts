import { HttpErrorResponse } from '@angular/common/http';

interface ApiErrorBody {
  error?: unknown;
}

export function apiErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof HttpErrorResponse)) return fallback;
  if (error.status === 0)
    return 'Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.';
  const body = error.error as ApiErrorBody | null;
  const message =
    body && typeof body === 'object' && typeof body.error === 'string' ? body.error : null;
  const translations: Record<string, string> = {
    'Invalid name or phone': 'Nome ou telefone não conferem.',
    'Name must contain only letters and spaces': 'O nome deve conter apenas letras e espaços.',
    'Name cannot contain special characters': 'O nome não pode conter caracteres especiais.',
    'Phone must use the format (XX) X XXXX-XXXX':
      'Use um celular brasileiro no formato (XX) 9 XXXX-XXXX.',
    'Phone is already registered': 'Este telefone já está cadastrado.',
    'Invalid request': 'Confira os dados informados.',
  };
  return message ? (translations[message] ?? fallback) : fallback;
}
