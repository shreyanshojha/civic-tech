/**
 * Root layout.
 *
 * The <PersistentDisclaimer/> is rendered HERE, as a sibling of the navigator
 * rather than inside any screen. That is the whole point: it is structurally
 * impossible for a route to omit it, mount without it, or turn it off. There is
 * no prop, no context flag, and no route option that hides it, and there is no
 * dismiss control.
 *
 * Mirrors apps/web/src/App.tsx, which renders the same component once outside
 * <Routes/>.
 */

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { PROJECT_NAME } from '@ftm/core';
import { PersistentDisclaimer } from '../src/components/Framing';
import { ThemeProvider, useTheme } from '../src/theme';

function Shell() {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: t.paper }}>
      <StatusBar style={t.scheme === 'dark' ? 'light' : 'dark'} />
      <View style={{ flex: 1 }}>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: t.paper },
            headerTintColor: t.accent,
            headerTitleStyle: { color: t.ink0, fontSize: 16, fontWeight: '600' },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: t.paper },
          }}
        >
          <Stack.Screen name="index" options={{ title: PROJECT_NAME }} />
          <Stack.Screen name="bills/index" options={{ title: 'Bills' }} />
          <Stack.Screen name="bills/[id]" options={{ title: 'Bill' }} />
          <Stack.Screen name="reps/index" options={{ title: 'Representatives' }} />
          <Stack.Screen name="reps/[bioguideId]" options={{ title: 'Member' }} />
          <Stack.Screen name="about" options={{ title: 'About & limitations' }} />
        </Stack>
      </View>
      {/* Not conditional. Not dismissable. Not per-screen. */}
      <PersistentDisclaimer bottomInset={insets.bottom} />
    </View>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <Shell />
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
