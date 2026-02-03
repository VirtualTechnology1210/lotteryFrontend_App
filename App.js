import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { createDrawerNavigator } from '@react-navigation/drawer';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { View, Text, ActivityIndicator } from 'react-native';

// Screens
import LoginScreen from './screens/LoginScreen';
import DashboardScreen from './screens/DashboardScreen';
import CategoryScreen from './screens/CategoryScreen';
import ProductScreen from './screens/ProductScreen';
import SalesScreen from './screens/SalesScreen';
import UserScreen from './screens/UserScreen';
import RolesPermissionsScreen from './screens/RolesPermissionsScreen';
import ReportsScreen from './screens/ReportsScreen';
import ReportResultScreen from './screens/ReportResultScreen';
import CustomDrawer from './components/CustomDrawer';
import { authService } from './services';

const Stack = createStackNavigator();
const Drawer = createDrawerNavigator();

// Screen configuration with permission mapping
const SCREEN_CONFIG = [
  { name: 'Dashboard', component: DashboardScreen, icon: 'home-outline', permKey: 'dashboard', alwaysShow: true },
  { name: 'Categories', component: CategoryScreen, icon: 'shape-outline', permKey: 'categories' },
  { name: 'Products', component: ProductScreen, icon: 'package-variant-closed', permKey: 'products' },
  { name: 'Sales', component: SalesScreen, icon: 'chart-line', permKey: 'sales' },
  { name: 'Reports', component: ReportsScreen, icon: 'file-chart-outline', permKey: 'reports' },
  { name: 'Users', component: UserScreen, icon: 'account-group-outline', permKey: 'users', adminOnly: true },
  { name: 'Roles & Permissions', component: RolesPermissionsScreen, icon: 'shield-account-outline', permKey: 'roles & permissions', adminOnly: true },
];

const DrawerNavigator = () => {
  const [permissions, setPermissions] = useState({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadPermissions = async () => {
      try {
        const perms = await authService.getPermissions();
        const adminStatus = await authService.isAdmin();
        setPermissions(perms);
        setIsAdmin(adminStatus);
      } catch (error) {
        console.error('Error loading permissions:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadPermissions();
  }, []);

  // Filter screens based on permissions
  const getVisibleScreens = () => {
    return SCREEN_CONFIG.filter(screen => {
      // Always show screens marked as alwaysShow
      if (screen.alwaysShow) return true;

      // Admin sees everything
      if (isAdmin) return true;

      // Admin-only screens are hidden for non-admins
      if (screen.adminOnly) return false;

      // Check view permission for the page
      const pagePerm = permissions[screen.permKey.toLowerCase()];
      return pagePerm?.view === true;
    });
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F9FD' }}>
        <ActivityIndicator size="large" color="#3a48c2" />
      </View>
    );
  }

  const visibleScreens = getVisibleScreens();

  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawer {...props} />}
      screenOptions={{
        headerShown: false,
        drawerActiveBackgroundColor: '#EEECFC',
        drawerActiveTintColor: '#2510C4',
        drawerInactiveTintColor: '#666',
        drawerLabelStyle: {
          marginLeft: -25,
          fontSize: 15,
          fontFamily: 'Roboto',
        },
      }}
    >
      {visibleScreens.map((screen) => (
        <Drawer.Screen
          key={screen.name}
          name={screen.name}
          component={screen.component}
          options={{
            drawerIcon: ({ color }) => (
              <MaterialCommunityIcons name={screen.icon} size={22} color={color} />
            )
          }}
        />
      ))}
    </Drawer.Navigator>
  );
};

const App = () => {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
          }}
          initialRouteName="Login">
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Home" component={DrawerNavigator} />
          <Stack.Screen name="ReportResult" component={ReportResultScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
};

export default App;