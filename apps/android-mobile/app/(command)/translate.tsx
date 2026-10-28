import { FieldProductProvider } from '@/navigation/field-product';
import TranslateScreen from '@/screens/translate/TranslateScreen';

export default function CommandTranslateScreen() {
  return (
    <FieldProductProvider product="venue">
      <TranslateScreen forceVertical="law_enforcement" />
    </FieldProductProvider>
  );
}
