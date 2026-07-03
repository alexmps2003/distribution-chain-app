import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiGet } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';

type Customer = {
  code: string;
  id: string;
  name: string;
  routeName?: string | null;
};

type CustomerSummary = {
  totalOutstanding?: string | number | null;
};

type CustomerRow = {
  customer: Customer;
  summary?: CustomerSummary | null;
};

export default function SearchCustomerScreen() {
  const { accessToken } = useAuth();
  const [query, setQuery] = useState('');
  const [customerRows, setCustomerRows] = useState<CustomerRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadCustomers() {
      try {
        setIsLoading(true);
        setErrorMessage(null);

        const rows = await apiGet<CustomerRow[]>(
          '/customers',
          accessToken ?? undefined,
        );

        if (isMounted) {
          setCustomerRows(rows);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : 'Unable to load customers right now.',
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadCustomers();

    return () => {
      isMounted = false;
    };
  }, [accessToken]);

  const filteredCustomers = useMemo(() => {
    const searchTerm = query.trim().toLowerCase();

    if (!searchTerm) {
      return customerRows;
    }

    return customerRows.filter(({ customer }) => {
      return (
        customer.name.toLowerCase().includes(searchTerm) ||
        customer.code.toLowerCase().includes(searchTerm)
      );
    });
  }, [customerRows, query]);

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

      {isLoading ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>Loading customers...</Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>{errorMessage}</Text>
        </View>
      ) : filteredCustomers.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No customers found.</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.customerList}
          contentContainerStyle={styles.customerListContent}
          keyboardShouldPersistTaps="handled"
        >
          {filteredCustomers.map(({ customer, summary }) => (
            <Pressable
              key={customer.id}
              style={styles.customerPressable}
              onPress={() => {
                router.push({
                  pathname: '/customer-payment',
                  params: {
                    customerId: customer.id,
                  },
                });
              }}
            >
              <View style={styles.customerCard}>
                <View style={styles.customerHeader}>
                  <Text style={styles.customerName}>{customer.name}</Text>
                  <Text style={styles.route}>
                    {customer.routeName?.trim() || 'Route unavailable'}
                  </Text>
                </View>

                <Text style={styles.customerCode}>{customer.code}</Text>

                <Text style={styles.outstanding}>
                  {formatOutstanding(summary?.totalOutstanding)}
                </Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function formatOutstanding(value: string | number | null | undefined) {
  if (value === null || value === undefined) {
    return 'Outstanding unavailable';
  }

  return `Outstanding Rs. ${Number(value).toLocaleString('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}`;
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
  emptyState: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 20,
    borderWidth: 1,
    marginHorizontal: 20,
    marginTop: 4,
    padding: 20,
  },
  emptyStateText: {
    color: '#64748b',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
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
