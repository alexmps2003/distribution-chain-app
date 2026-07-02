import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const customers = [
  {
    code: 'CUS-001',
    name: 'ABC Stores',
    outstanding: 'Rs. 52,300',
    route: 'Route A',
  },
  {
    code: 'CUS-002',
    name: 'Perera Traders',
    outstanding: 'Rs. 18,500',
    route: 'Route A',
  },
  {
    code: 'CUS-003',
    name: 'Nimal Stores',
    outstanding: 'Rs. 91,000',
    route: 'Route B',
  },
];

export default function SearchCustomerScreen() {
  const [query, setQuery] = useState('');

  const filteredCustomers = useMemo(() => {
    const searchTerm = query.trim().toLowerCase();

    if (!searchTerm) {
      return customers;
    }

    return customers.filter(
      (customer) =>
        customer.name.toLowerCase().includes(searchTerm) ||
        customer.code.toLowerCase().includes(searchTerm),
    );
  }, [query]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <Text style={styles.kicker}>Collect Payment</Text>
        <Text style={styles.title}>Select Customer</Text>
      </View>

      <View style={styles.searchWrap}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search by customer name or code"
          placeholderTextColor="#94a3b8"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.searchInput}
        />
      </View>

      <ScrollView
        style={styles.customerList}
        contentContainerStyle={styles.customerListContent}
        keyboardShouldPersistTaps="handled"
      >
        {filteredCustomers.map((customer) => (
          <Pressable key={customer.code} style={styles.customerPressable}>
            <View style={styles.customerCard}>
              <View style={styles.customerHeader}>
                <Text style={styles.customerName}>{customer.name}</Text>
                <Text style={styles.route}>{customer.route}</Text>
              </View>

              <Text style={styles.customerCode}>{customer.code}</Text>

              <Text style={styles.outstanding}>
                Outstanding {customer.outstanding}
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  customerCard: {
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
  },
  customerCode: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
    marginTop: 4,
  },
  customerHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  customerList: {
    flex: 1,
  },
  customerListContent: {
    paddingBottom: 28,
    paddingHorizontal: 20,
  },
  customerName: {
    color: '#020617',
    flex: 1,
    fontSize: 20,
    fontWeight: '900',
    paddingRight: 12,
  },
  customerPressable: {
    marginBottom: 16,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 56,
  },
  kicker: {
    color: '#0369a1',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  outstanding: {
    color: '#0369a1',
    fontSize: 17,
    fontWeight: '900',
    marginTop: 0,
  },
  route: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '800',
  },
  safeArea: {
    backgroundColor: '#f1f5f9',
    flex: 1,
  },
  searchInput: {
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 18,
    borderWidth: 1,
    color: '#020617',
    fontSize: 17,
    fontWeight: '600',
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  searchWrap: {
    paddingBottom: 18,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  title: {
    color: '#020617',
    fontSize: 32,
    fontWeight: '900',
    marginTop: 8,
  },
});
