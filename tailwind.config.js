/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            keyframes: {
                'pulse-slow': {
                    '0%, 100%': { transform: 'scale(1)', opacity: '0.5' },
                    '50%': { transform: 'scale(1.1)', opacity: '0.8' },
                },
                'ping-slow': {
                    '0%': { transform: 'scale(1)', opacity: '0.5' },
                    '100%': { transform: 'scale(2)', opacity: '0' },
                },
                'ping-slower': {
                    '0%': { transform: 'scale(1)', opacity: '0.3' },
                    '100%': { transform: 'scale(2.5)', opacity: '0' },
                },
                slideIn: {
                    'from': { opacity: '0', transform: 'translateY(10px)' },
                    'to': { opacity: '1', transform: 'translateY(0)' },
                }
            },
            animation: {
                'pulse-slow': 'pulse-slow 8s infinite ease-in-out',
                'ping-slow': 'ping-slow 3s infinite cubic-bezier(0, 0, 0.2, 1)',
                'ping-slower': 'ping-slower 4s infinite cubic-bezier(0, 0, 0.2, 1)',
                'slide-in': 'slideIn 0.3s ease-out forwards',
                'spin-slow': 'spin 20s linear infinite',
            },
            fontFamily: {
                sans: ['Space Grotesk', 'system-ui', 'sans-serif'],
            },
        },
    },
    plugins: [],
}
