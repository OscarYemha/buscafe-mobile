import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ActivityIndicator, View } from "react-native";
import AppNavigator from "./src/navigation/AppNavigator";
import { ReviewDraftProvider } from "./src/context/ReviewDraftContext";
import { AuthProvider } from "./src/context/AuthContext";
import { ReviewsProvider } from "./src/context/ReviewsContext";
import { useAuth } from "./src/context/AuthContext";
import { FavoritesProvider } from "./src/context/FavoritesContext";

function AppContent()
{
  const { isRestoringSession } = useAuth();

  if (isRestoringSession)
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