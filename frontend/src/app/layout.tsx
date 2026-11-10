import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "../contexts/AuthContext";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  fallback: ["system-ui", "arial", "sans-serif"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "UML Editor - CASE Colaborativo",
  description: "Herramienta CASE colaborativa para diagramas UML con IA",
};

// Layout raiz: fuente Inter + AuthProvider global + cadena h-full.
// La cadena html.h-full -> body.h-full -> ... -> min-h-0 es OBLIGATORIA:
// sin altura encadenada React Flow mide 0x0 y falla con error de dimensiones.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${inter.variable} h-full`}>
      <body className="h-full bg-white font-sans text-gray-900 antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
