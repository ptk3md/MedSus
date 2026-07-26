export const escapeHTML = (value: unknown): string =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

export const uid = (prefix: string): string =>
  `${prefix}-${typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;

export const formatDateTime = (iso: string): string =>
  new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));

export const formatDate = (iso: string): string =>
  new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date(iso));

export const formValue = (data: FormData, name: string): string => String(data.get(name) ?? '').trim();

export const checkedValues = (form: HTMLFormElement, name: string): string[] =>
  Array.from(form.querySelectorAll<HTMLInputElement>(`input[name="${name}"]:checked`)).map((input) => input.value);

export const downloadText = (filename: string, content: string, type = 'application/json'): void => {
  const blob = new Blob([content], { type });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 500);
};
