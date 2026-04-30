import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';

export default function FormDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  return (
    <ScrollView style={styles.container}>
      <Stack.Screen options={{ title: `Form ${id}` }} />
      
      <View style={styles.header}>
        <Text style={styles.title}>Form Details</Text>
        <Text style={styles.id}>ID: {id}</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.placeholder}>Form renderer will go here.</Text>
        <Text style={styles.description}>
          This screen will dynamically load the form schema from Supabase and render the appropriate inputs.
        </Text>
      </View>

      <TouchableOpacity 
        style={styles.submitButton}
        onPress={() => router.back()}
      >
        <Text style={styles.submitText}>Submit Response</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    padding: 24,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  id: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  content: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 300,
  },
  placeholder: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  submitButton: {
    margin: 24,
    backgroundColor: '#000',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
