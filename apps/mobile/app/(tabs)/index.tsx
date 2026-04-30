import { StyleSheet, Text, View, FlatList, TouchableOpacity } from 'react-native';
import { Link } from 'expo-router';

const MOCK_FORMS = [
  { id: '1', title: 'Daily Site Inspection', responses: 12 },
  { id: '2', title: 'Inventory Count', responses: 5 },
  { id: '3', title: 'Safety Audit', responses: 0 },
];

export default function FormsScreen() {
  return (
    <View style={styles.container}>
      <FlatList
        data={MOCK_FORMS}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Link href={`/form/${item.id}`} asChild>
            <TouchableOpacity style={styles.card}>
              <View>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardSubtitle}>{item.responses} submissions</Text>
              </View>
              <Text style={styles.chevron}>→</Text>
            </TouchableOpacity>
          </Link>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  list: {
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  chevron: {
    fontSize: 20,
    color: '#ccc',
  },
});
