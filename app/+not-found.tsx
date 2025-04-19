import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

export default function NotFoundScreen() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Text style={{ fontSize: 18, marginBottom: 10 }}>Cet écran n'existe pas.</Text>
      <TouchableOpacity
        onPress={() => router.replace('/(auth)/sign-in')}
        style={{
          backgroundColor: '#6200ea',
          paddingVertical: 10,
          paddingHorizontal: 20,
          borderRadius: 5,
        }}
      >
        <Text style={{ color: '#fff', fontSize: 16 }}>Aller à la page de connexion</Text>
      </TouchableOpacity>
    </View>
  );
}