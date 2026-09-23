// Design System compartido: dashboard + editor.
// Clases Tailwind reutilizables para consistencia visual.

export const DS = {
  colors: {
    primary: 'blue-600',
    primaryHover: 'blue-700',
    danger: 'red-600',
    success: 'green-600',
    neutral: 'gray-700',
    background: 'gray-50',
    surface: 'white',
    border: 'gray-200',
  },

  button: {
    base: 'px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    ghost: 'text-gray-700 hover:bg-gray-100',
  },

  input: {
    base: 'px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
  },

  card: {
    base: 'bg-white border border-gray-200 rounded-lg',
    shadow: 'shadow-sm hover:shadow-md transition-shadow',
  },

  header: {
    base: 'bg-white border-b border-gray-200',
    inner: 'max-w-7xl mx-auto px-6 py-4 flex items-center justify-between',
  },
} as const;
