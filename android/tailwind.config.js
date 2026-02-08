/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
    theme: {
        extend: {
            colors: {
                slate: {
                    900: '#0f172a',
                    800: '#1e293b',
                    700: '#334155',
                    600: '#475569',
                    500: '#64748b',
                    400: '#94a3b8',
                    300: '#cbd5e1',
                },
                cyan: {
                    400: '#22d3ee',
                    500: '#06b6d4',
                },
                purple: {
                    500: '#a855f7',
                    600: '#9333ea',
                }
            },
        },
    },
    plugins: [],
};
