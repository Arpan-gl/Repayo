import './globals.css';

export const metadata = {
  title: 'Repayo | MSME Loan Repayment Engine',
  description: 'Precision loan repayment schedule generator, allocation engine and real-time position tracker for MSME lending.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
