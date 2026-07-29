import { ScrollView, Text } from 'react-native';
import { Link, Stack } from 'expo-router';
import { NotFoundBody, Screen } from '../src/components/ui';
import { useTheme } from '../src/theme';

export default function NotFound() {
  const t = useTheme();
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <Screen>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <NotFoundBody what="Screen not found" />
          <Link href="/" style={{ marginTop: 16 }}>
            <Text style={{ fontSize: 14, color: t.accent }}>Back to the start</Text>
          </Link>
        </ScrollView>
      </Screen>
    </>
  );
}
