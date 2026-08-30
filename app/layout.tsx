import type {Metadata} from 'next';
import {Geist} from 'next/font/google';
import './globals.css';
const geist=Geist({variable:'--font-geist',subsets:['latin']});
export const metadata:Metadata={title:'Cuida · Gestión del hogar',description:'Pagos, recibos y recordatorios para gestionar una relación laboral en el hogar.',openGraph:{title:'Cuida',description:'La gestión del hogar, en orden',images:[{url:'/og.png',width:1672,height:941,alt:'Cuida — La gestión del hogar, en orden'}]},twitter:{card:'summary_large_image',title:'Cuida',description:'La gestión del hogar, en orden',images:['/og.png']}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="es"><body className={geist.variable}>{children}</body></html>}
