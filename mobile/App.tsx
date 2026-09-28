import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ActivityIndicator, View } from "react-native";
import AppNavigator from "./src/navigation/AppNavigator";
import { ReviewDraftProvider } from "./src/context/ReviewDraftContext";
import { AuthProvider } from "./src/context/AuthContext";
import { ReviewsProvider } from "./src/context/ReviewsContext";
import { useAuth } from "./src/context/AuthContext";
import { FavoritesProvider } from "./src/context/FavoritesContext";
import { useEffect, useState } from "react";
import * as SplashScreen from "expo-splash-screen";

SplashScreen.preventAutoHideAsync();

function AppContent()
{
  const { isRestoringSession } = useAuth();

  const [minimunSplashTimeElapsed, setMinimunSplashTimeElapsed] = useState(false);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setMinimunSplashTimeElapsed(true);
    }, 1500);

    return () => {
      clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    if (!isRestoringSession && minimunSplashTimeElapsed)
    {
      SplashScreen.hideAsync();
    }
  }, [
      isRestoringSession,
      minimunSplashTimeElapsed,
    ]);

  if (isRestoringSession || !minimunSplashTimeElapsed)
  {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#F8F1E7",
        }}
      >
        <ActivityIndicator
          size="large"
          color="#6B3A22"
        />
      </View>
    );
  }

  return (
      <FavoritesProvider>
        <ReviewsProvider>
          <ReviewDraftProvider>
            <NavigationContainer>
              <AppNavigator />
            </NavigationContainer>
          </ReviewDraftProvider>
        </ReviewsProvider>
      </FavoritesProvider>
  );
};

export default function App()
{
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </SafeAreaProvider>
  );
}