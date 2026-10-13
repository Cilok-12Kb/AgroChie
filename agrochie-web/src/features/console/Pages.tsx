'use client';
import type { Workspace } from './hooks';
import { Dashboard } from './Dashboard';
import { ProfileForm } from './forms/ProfileForm';
import { SeasonFlow } from './forms/SeasonFlow';
import { ExpenseForm } from './forms/ExpenseForm';
import { Prediction, Budget, Cashflow } from './views/FinanceViews';
import { FieldWeather } from './views/EnvironmentView';
import { HistoryPage, Credit, ReminderPage } from './views/OperationsViews';
import { Assistant } from './views/AssistantView';
import { DetectionView } from './views/DetectionView'; // [REVISI]
export type Section = 'beranda' | 'profil' | 'musim-tanam' | 'catatan' | 'prediksi' | 'rencana-biaya' | 'kalender-uang' | 'cuaca-lahan' | 'riwayat-musim' | 'risiko-kredit' | 'pengingat' | 'asisten' | 'deteksi-tanaman';
export function ConsoleRoute({section,w}:{section:Section;w:Workspace}) {
  switch(section){
    case 'beranda': return <Dashboard workspace={w}/>;
    case 'profil': return <ProfileForm w={w}/>;
    case 'musim-tanam': return <SeasonFlow w={w}/>;
    case 'catatan': return <ExpenseForm w={w}/>;
    case 'prediksi': return <Prediction w={w}/>;
    case 'rencana-biaya': return <Budget w={w}/>;
    case 'kalender-uang': return <Cashflow w={w}/>;
    case 'cuaca-lahan': return <FieldWeather w={w}/>;
    case 'riwayat-musim': return <HistoryPage w={w}/>;
    case 'risiko-kredit': return <Credit w={w}/>;
    case 'pengingat': return <ReminderPage w={w}/>;
    case 'asisten': return <Assistant w={w}/>;
    case 'deteksi-tanaman': return <DetectionView w={w}/>;
  }
}
