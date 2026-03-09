import {
  NavigationContainer,
  DarkTheme,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useCallback, useMemo } from 'react';
import { AdminSessionProvider, useAdminSession } from '../context/AdminSessionContext';
import CameraCaptureScreen from '../screens/CameraCaptureScreen';
import ConfirmationScreen from '../screens/ConfirmationScreen';
import HomeScreen from '../screens/HomeScreen';
import AdminSettingsScreen from '../screens/admin/AdminSettingsScreen';
import AdminAuthScreen from '../screens/admin/AdminAuthScreen';
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import ChangeAdminPinScreen from '../screens/admin/ChangeAdminPinScreen';
import DangerZoneScreen from '../screens/admin/DangerZoneScreen';
import EmployeeFormScreen from '../screens/admin/EmployeeFormScreen';
import EmployeeListScreen from '../screens/admin/EmployeeListScreen';
import LogsScreen from '../screens/admin/LogsScreen';
import PayrollHoursScreen from '../screens/admin/PayrollHoursScreen';
import ResetEmployeePinScreen from '../screens/admin/ResetEmployeePinScreen';
import { colors } from '../theme';
import type { RootStackParamList } from '../types/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();

function AppStack() {
  const { isAuthenticated } = useAdminSession();

  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: colors.background },
        headerShown: false,
      }}
    >
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen
        name="CameraCapture"
        component={CameraCaptureScreen}
        options={{ animation: 'fade_from_bottom' }}
      />
      <Stack.Screen
        name="Confirmation"
        component={ConfirmationScreen}
        options={{ animation: 'fade' }}
      />
      <Stack.Screen
        name="AdminAuth"
        component={AdminAuthScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      {isAuthenticated ? (
        <>
          <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
          <Stack.Screen name="AdminEmployees" component={EmployeeListScreen} />
          <Stack.Screen name="AdminEmployeeForm" component={EmployeeFormScreen} />
          <Stack.Screen
            name="AdminResetEmployeePin"
            component={ResetEmployeePinScreen}
          />
          <Stack.Screen name="AdminLogs" component={LogsScreen} />
          <Stack.Screen name="AdminSettings" component={AdminSettingsScreen} />
          <Stack.Screen name="AdminPayrollHours" component={PayrollHoursScreen} />
          <Stack.Screen name="AdminChangePin" component={ChangeAdminPinScreen} />
          <Stack.Screen name="AdminDangerZone" component={DangerZoneScreen} />
        </>
      ) : null}
    </Stack.Navigator>
  );
}

export default function RootNavigator() {
  const navigationRef = useMemo(
    () => createNavigationContainerRef<RootStackParamList>(),
    [],
  );

  const handleAdminLogout = useCallback(() => {
    if (!navigationRef.isReady()) {
      return;
    }
    navigationRef.resetRoot({
      index: 0,
      routes: [{ name: 'Home' }],
    });
  }, [navigationRef]);

  return (
    <AdminSessionProvider onLogout={handleAdminLogout}>
      <NavigationContainer
        ref={navigationRef}
        theme={{
          ...DarkTheme,
          colors: {
            ...DarkTheme.colors,
            background: colors.background,
            border: colors.borderStrong,
            card: colors.background,
            notification: colors.primary,
            primary: colors.primary,
            text: colors.textPrimary,
          },
        }}
      >
        <AppStack />
      </NavigationContainer>
    </AdminSessionProvider>
  );
}
