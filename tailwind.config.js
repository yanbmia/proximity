/** @type {import('tailwindcss').Config} */


module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: 
  {
    borderWidth: {
      DEFAULT: '1px',
      '0': '0',
      '0.5':'0.5px',
      '1':'1px',
      '2': '2px',
      '3': '3px',
      '4': '4px',
      '6': '6px',
      '8': '8px',
    },
    screens: {
      'sm': '640px',
      // => @media (min-width: 640px) { ... }

      'md': '850px',
      // => @media (min-width: 850px) { ... }

      'lg': '1024px',
      // => @media (min-width: 1024px) { ... }

      'xl': '1280px',
      // => @media (min-width: 1280px) { ... }

      '2xl': '1536px',
      // => @media (min-width: 1536px) { ... },
      '3xl': '1800px'
    },

    extend: {
      // --- COLOR -----------------------------------------------------------
      colors: {
        ink: {
          950: '#141416',
          900: '#19191C',
          850: '#1C1B1E', 
          800: '#232327',
          750: '#2A292E',
          700: '#323136',
        },
        rule: {
          DEFAULT: '#464648', // measured
          soft: '#2E2D31',
        },

        paper: {
          DEFAULT: '#F1F1F1', 
          mid: '#BEBABF',   
          low: '#8A858C',  
          lav: '#6A5C7D',   
        },
        // Accent.
        brand: {
          DEFAULT: '#8130FA',
          hi: '#9450FF',
          ink: '#0B0B0D',  
          wash: 'rgba(129, 48, 250, 0.14)',
          line: 'rgba(129, 48, 250, 0.42)',
        },

        cat: {
          uni: '#8130FA',
          safety: '#FF5C7A',
          parks: '#3FD9A0',
          grocery: '#FF9F45',
          subway: '#5AA7FF',
          budget: '#FFD05C',
          bike: '#BEBABF',
        },
      },


      fontFamily: {
        sans: ['Geist', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        display: ['Geist', '-apple-system', 'BlinkMacSystemFont', 'Helvetica', 'sans-serif'],
      },

      fontSize: {
        xxs: ['6px','8px'],
        xs: ['12px','16px'],
        sm: ['14px', '20px'],
        base: ['16px', '24px'],
        lg: ['20px', '28px'],
        xl: ['24px', '32px'],

        micro:   ['11px', { lineHeight: '1.2',  letterSpacing: '0.08em', fontWeight: '400' }],
        label:   ['12px', { lineHeight: '1.2',  letterSpacing: '0.08em', fontWeight: '500' }],
        bodysm:  ['13px', { lineHeight: '1.45', letterSpacing: '0.03em', fontWeight: '300' }],
        bodymd:  ['14px', { lineHeight: '1.4',  letterSpacing: '0.03em', fontWeight: '300' }],
        bodylg:  ['16px', { lineHeight: '1.4',  letterSpacing: '0.03em', fontWeight: '300' }],
        headsm:  ['17px', { lineHeight: '1.15', letterSpacing: '-0.02em', fontWeight: '500' }],
        headmd:  ['20px', { lineHeight: '1.1',  letterSpacing: '-0.02em', fontWeight: '500' }],
        headlg:  ['26px', { lineHeight: '1.05', letterSpacing: '-0.02em', fontWeight: '500' }],
      },

      opacity: {
        35: '0.35',
        45: '0.45',
        55: '0.55',
        65: '0.65',
        85: '0.85',
        97: '0.97',
      },

      letterSpacing: {
        display: '-0.02em',
        body: '0.03em',
        label: '0.08em',
        wide2: '0.12em',
      },


      borderRadius: {
        none: '0px',
        sm: '2px',
        DEFAULT: '3px',
        md: '3px',
        lg: '3px',
        xl: '4px',
        '2xl': '4px',
        '3xl': '6px',
        full: '9999px',
      },


      transitionTimingFunction: {
        brand: 'cubic-bezier(0.44, 0, 0.56, 1)',  // measured: primary tween
        rise:  'cubic-bezier(0.12, 0.23, 0.5, 1)', // measured: long entrances
      },
      transitionDuration: {
        '240': '240ms',
        '380': '380ms',
        '640': '640ms',
        '720': '720ms',
      },
      transitionProperty: {
        'border':"border",
        'scale':"scale"
      },

      keyframes: {
        'px-reveal': {
          '0%':   { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'px-panel-in': {
          '0%':   { opacity: '0', transform: 'translateY(-6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'px-reveal': 'px-reveal 640ms cubic-bezier(0.44, 0, 0.56, 1) both',
        'px-panel-in': 'px-panel-in 380ms cubic-bezier(0.44, 0, 0.56, 1) both',
      },

      boxShadow: {
        panel: '0 0 24px 12px rgba(20, 20, 22, 0.55)',
        lift: '0 0 0 1px rgba(70, 70, 72, 0.9)',
      },

      height: {
        '108': '36rem',
        '116': '42rem',
        '128': '50rem',
        '140': '60rem',
        '160':'70rem'
      },
      spacing: {
        '0.25':'1px',
        '22px':'22px',
        '66px':'66px',
        '90':'22rem',
        '98':'26rem',
        '100':'28rem',
        '108': '36rem',
        '128': '44rem',
        '140': '46rem',
      },
      borderWidth: {
        DEFAULT: '1px',
        '0': '0',
        '2': '2px',
        '3': '3px',
        '4': '4px',
        '6': '6px',
        '8': '8px',
        '16': '16px',
        '20':'20px',
        '80':'80px',
        '40':'40px'
      },
      scale: {
        '10': '0.10',
        '20': '0.20',
        '30': '0.30',
        '40': '0.40',
        '60': '0.60',
        '70': '0.70',
        '80': '0.80',
        '90': '0.90',
        '120': '1.20',
        '175':'1.75',
        '500':'5.00',
      },
    },
  }
}
