import { useFonts } from 'expo-font';
import { Barlow_700Bold, Barlow_800ExtraBold } from '@expo-google-fonts/barlow';
import {
  Quicksand_400Regular,
  Quicksand_500Medium,
  Quicksand_600SemiBold,
  Quicksand_700Bold,
} from '@expo-google-fonts/quicksand';
import { ActivityIndicator, View } from 'react-native';
import { SignInScreen } from '../screens/SignInScreen';
import { ScannerHomeScreen } from '../screens/ScannerHomeScreen';
import { useSecuritySession } from '../hooks/useSecuritySession';
import { colors } from '../theme';

export default function IndexRoute() {
  const [fontsLoaded] = useFonts({
    Barlow_700Bold,
    Barlow_800ExtraBold,
    Quicksand_400Regular,
    Quicksand_500Medium,
    Quicksand_600SemiBold,
    Quicksand_700Bold,
  });
  const session = useSecuritySession();

  if (!fontsLoaded || session.isRestoring) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  return session.user ? <ScannerHomeScreen /> : <SignInScreen />;
}
