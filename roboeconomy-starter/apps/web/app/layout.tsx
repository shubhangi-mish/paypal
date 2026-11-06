import "./globals.css";
export const metadata = { title: "RoboEconomy", description: "The economic network for autonomous machines" };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en"><body>{children}</body></html>; }
