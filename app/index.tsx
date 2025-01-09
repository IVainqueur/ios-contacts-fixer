import { useState, useCallback, useEffect } from "react";
import { View, StyleSheet, TextInput, FlatList, Pressable, ActivityIndicator, RefreshControl } from "react-native";
// import { SafeAreaView } from "react-native-safe-area-context";
import { useThemeColor } from "@/hooks/useThemeColor";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import * as Contacts from "expo-contacts";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface PhoneNumber {
  label: string;
  number: string;
  id?: string;
}

interface Contact {
  id: string;
  name: string;
  phoneNumbers: PhoneNumber[];
  needsFix: boolean;
}

const isRwandanNumber = (number: string) => {
  // Remove any spaces or special characters
  const cleanNumber = number.replace(/[\s-]/g, "");
  return cleanNumber.startsWith("07") || cleanNumber.startsWith("+2507");
};

const addCountryCode = (number: string) => {
  const cleanNumber = number.replace(/[\s-]/g, "");
  return cleanNumber.startsWith("07") ? "+250" + cleanNumber : cleanNumber;
};

const removeCountryCode = (number: string) => {
  const cleanNumber = number.replace(/[\s-]/g, "");
  return cleanNumber.startsWith("+2507") ? cleanNumber.slice(3) : cleanNumber;
};

const validateContact = (phoneNumbers: PhoneNumber[]): boolean => {
  const rwandanNumbers = phoneNumbers
    .map((p) => p.number.replace(/[\s-]/g, ""))
    .filter(isRwandanNumber);

  for (const number of rwandanNumbers) {
    const withCode = addCountryCode(number);
    const withoutCode = removeCountryCode(number);
    const hasWithCode = rwandanNumbers.includes(withCode);
    const hasWithoutCode = rwandanNumbers.includes(withoutCode);

    if (!hasWithCode || !hasWithoutCode) {
      return false;
    }
  }

  return rwandanNumbers.length > 0;
};

interface LoadingStates {
  loadingContacts: boolean;
  updatingContacts: Set<string>; // Set of contact IDs being updated
  fixingSelected: boolean;
}

const getNextLabel = (label: string, existingLabels: string[]): string => {
  let primeCount = 0;
  const baseLabel = label.replace(/'/g, ''); // Remove any existing primes
  const labelPattern = new RegExp(`^${baseLabel}'*$`);
  
  // Count existing labels with primes
  existingLabels.forEach(existing => {
    if (labelPattern.test(existing)) {
      const primes = existing.match(/'/g)?.length || 0;
      primeCount = Math.max(primeCount, primes);
    }
  });
  
  // Add one more prime than the highest count found
  return `${baseLabel}${"'".repeat(primeCount + 1)}`;
};

export default function ContactsScreen() {
    const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(
    new Set()
  );
  const backgroundColor = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");
  const tintColor = useThemeColor({}, "tint");
  const errorColor = "#ff6b6b";
  const [loadingStates, setLoadingStates] = useState<LoadingStates>({
    loadingContacts: true,
    updatingContacts: new Set(),
    fixingSelected: false,
  });

  const loadContacts = useCallback(async () => {
    setLoadingStates(prev => ({ ...prev, loadingContacts: true }));
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status === "granted") {
        const { data } = await Contacts.getContactsAsync({
          fields: [
            Contacts.Fields.FirstName,
            Contacts.Fields.LastName,
            Contacts.Fields.PhoneNumbers,
            Contacts.Fields.ID,
          ],
        });

        const formattedContacts: Contact[] = data
          .filter((contact) => {
            // First check if contact has valid ID and name
            if (!contact.id || (!contact.firstName && !contact.lastName)) {
              return false;
            }

            // Check if contact has any Rwandan numbers
            const rwandanNumbers = contact.phoneNumbers
              ?.filter(phone => phone.number != null)
              .map(phone => phone.number!.replace(/[\s-]/g, ""))
              .filter(isRwandanNumber) || [];

            if (rwandanNumbers.length === 0) {
              return false;
            }

            // Check if any Rwandan number doesn't have both versions
            for (const number of rwandanNumbers) {
              const withCode = number.startsWith("07") ? "+25" + number : number;
              const withoutCode = number.startsWith("+2507") ? number.slice(3) : number;
              
              const hasWithCode = rwandanNumbers.includes(withCode);
              const hasWithoutCode = rwandanNumbers.includes(withoutCode);

              // If we find a number that doesn't have both versions, include this contact
              if (!hasWithCode || !hasWithoutCode) {
                return true;
              }
            }

            // If all numbers have both versions, don't include this contact
            return false;
          })
          .map((contact) => ({
            id: contact.id!,
            name: `${contact.firstName || ""} ${contact.lastName || ""}`.trim(),
            phoneNumbers: (contact.phoneNumbers || [])
              .filter((phone) => phone.number != null && isRwandanNumber(phone.number))
              .map((phone) => ({
                label: phone.label?.replace("_", " ").toLowerCase() || "other",
                number: phone.number!,
                id: phone.id,
              })),
            needsFix: true, // All contacts in this list need fixing
          }));

        // Remove the separate needsFix calculation since all contacts in the list need fixing
        setContacts(formattedContacts);
        setSelectedContacts(new Set());
      }
    } catch (error) {
      console.error("Error loading contacts:", error);
    } finally {
      setLoadingStates(prev => ({ ...prev, loadingContacts: false }));
    }
  }, []);

  const handleFix = useCallback(
    async (contact: Contact) => {
      setLoadingStates(prev => ({
        ...prev,
        updatingContacts: new Set([...prev.updatingContacts, contact.id])
      }));

      try {
        const updatedPhoneNumbers: PhoneNumber[] = [...contact.phoneNumbers];
        const existingLabels = contact.phoneNumbers.map(p => p.label);
        const rwandanNumbers = contact.phoneNumbers.filter((p) =>
          isRwandanNumber(p.number)
        );

        for (const phone of rwandanNumbers) {
          const cleanNumber = phone.number.replace(/[\s-]/g, "");
          
          if (cleanNumber.startsWith("07")) {
            // If number starts with 07, add the +25 version
            const withCode = "+25" + cleanNumber;
            if (!contact.phoneNumbers.some(p => p.number.replace(/[\s-]/g, "") === withCode)) {
              updatedPhoneNumbers.push({
                label: getNextLabel(phone.label, existingLabels),
                number: withCode,
              });
            }
          } else if (cleanNumber.startsWith("+2507")) {
            // If number starts with +2507, add the 0 version
            const withoutCode = cleanNumber.slice(3); // Remove +25
            if (!contact.phoneNumbers.some(p => p.number.replace(/[\s-]/g, "") === withoutCode)) {
              updatedPhoneNumbers.push({
                label: getNextLabel(phone.label, existingLabels),
                number: withoutCode,
              });
            }
          }
        }

        console.log("Updated phone numbers:", updatedPhoneNumbers);

        await Contacts.updateContactAsync({
          [Contacts.Fields.ID]: contact.id,
          [Contacts.Fields.PhoneNumbers]: updatedPhoneNumbers.map((phone) => ({
            label: phone.label,
            number: phone.number,
            id: phone.id,
          })),
          name: contact.name,
          contactType: "person",
        });

        // Reload contacts after update
        await loadContacts();
      } catch (error) {
        console.error("Error updating contact:", error);
      } finally {
        setLoadingStates(prev => {
          const newUpdating = new Set(prev.updatingContacts);
          newUpdating.delete(contact.id);
          return { ...prev, updatingContacts: newUpdating };
        });
      }
    },
    [loadContacts]
  );
  const handleFixSelected = useCallback(async () => {
    setLoadingStates(prev => ({ ...prev, fixingSelected: true }));
    try {
      // Create a temporary array to store all phone number updates
      const updatePromises = [];
      
      for (const contactId of selectedContacts) {
        const contact = contacts.find((c) => c.id === contactId);
        if (contact) {
          const updatedPhoneNumbers: PhoneNumber[] = [...contact.phoneNumbers];
          const existingLabels = contact.phoneNumbers.map(p => p.label);
          const rwandanNumbers = contact.phoneNumbers.filter((p) =>
            isRwandanNumber(p.number)
          );

          for (const phone of rwandanNumbers) {
            const cleanNumber = phone.number.replace(/[\s-]/g, "");
            
            if (cleanNumber.startsWith("07")) {
              const withCode = "+25" + cleanNumber;
              if (!contact.phoneNumbers.some(p => p.number.replace(/[\s-]/g, "") === withCode)) {
                updatedPhoneNumbers.push({
                  label: getNextLabel(phone.label, existingLabels),
                  number: withCode,
                });
              }
            } else if (cleanNumber.startsWith("+2507")) {
              const withoutCode = cleanNumber.slice(3);
              if (!contact.phoneNumbers.some(p => p.number.replace(/[\s-]/g, "") === withoutCode)) {
                updatedPhoneNumbers.push({
                  label: getNextLabel(phone.label, existingLabels),
                  number: withoutCode,
                });
              }
            }
          }

          // Add the update promise to our array
          updatePromises.push(
            Contacts.updateContactAsync({
              [Contacts.Fields.ID]: contact.id,
              [Contacts.Fields.PhoneNumbers]: updatedPhoneNumbers.map((phone) => ({
                label: phone.label,
                number: phone.number,
                id: phone.id,
              })),
              name: contact.name,
              contactType: "person",
            })
          );
        }
      }

      // Wait for all updates to complete
      await Promise.all(updatePromises);
      
      // Only reload contacts once after all updates are done
      await loadContacts();
      setSelectedContacts(new Set());
    } catch (error) {
      console.error("Error fixing selected contacts:", error);
    } finally {
      setLoadingStates(prev => ({ ...prev, fixingSelected: false }));
    }
  }, [contacts, selectedContacts, loadContacts]);

  const toggleSelect = useCallback((contactId: string) => {
    setSelectedContacts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(contactId)) {
        newSet.delete(contactId);
      } else {
        newSet.add(contactId);
      }
      return newSet;
    });
  }, []);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const filteredContacts = contacts
    .filter((contact) =>
      contact.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  const renderPhoneNumbers = useCallback(
    (contact: Contact) => (
      <View style={styles.phoneNumbersContainer}>
        {contact.phoneNumbers.map((phone, index) => (
          <View key={index} style={styles.phoneNumberRow}>
            <ThemedText style={styles.phoneLabel}>{phone.label}</ThemedText>
            <ThemedText style={[styles.phoneNumber, styles.rwandanNumber]}>
              {phone.number}
            </ThemedText>
          </View>
        ))}
        {contact.needsFix && (
          <Pressable
            style={[
              styles.fixButton,
              { backgroundColor: errorColor },
              loadingStates.updatingContacts.has(contact.id) && styles.disabledButton
            ]}
            onPress={() => handleFix(contact)}
            disabled={loadingStates.updatingContacts.has(contact.id)}
          >
            {loadingStates.updatingContacts.has(contact.id) ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <ThemedText style={styles.fixButtonText}>Fix Contact</ThemedText>
            )}
          </Pressable>
        )}
      </View>
    ),
    [handleFix, loadingStates.updatingContacts]
  );

  const selectAll = useCallback(() => {
    const contactsToSelect = contacts
      .filter((contact) => contact.needsFix)
      .map((contact) => contact.id);
    setSelectedContacts(new Set(contactsToSelect));
  }, [contacts]);

  const clearSelection = useCallback(() => {
    setSelectedContacts(new Set());
  }, []);

  const renderContact = useCallback(
    ({ item }: { item: Contact }) => (
      <Pressable
        onPress={() => toggleSelect(item.id)}
        style={[
          styles.contactItem,
          { borderBottomColor: tintColor + "20" },
          item.needsFix && styles.needsFixContainer,
          selectedContacts.has(item.id) && styles.selectedContainer,
        ]}
      >
        <View
          style={[
            styles.avatarContainer,
            {
              backgroundColor: item.needsFix
                ? errorColor
                : selectedContacts.has(item.id)
                ? tintColor
                : backgroundColor,
            },
          ]}
        >
          {selectedContacts.has(item.id) ? (
            <Ionicons name="checkmark" size={24} color="white" />
          ) : (
            <ThemedText style={styles.avatarText}>
              {item.name.charAt(0)}
            </ThemedText>
          )}
        </View>
        <View style={styles.contactInfo}>
          <ThemedText style={styles.contactName}>{item.name}</ThemedText>
          {renderPhoneNumbers(item)}
        </View>
      </Pressable>
    ),
    [
      tintColor,
      backgroundColor,
      renderPhoneNumbers,
      selectedContacts,
      toggleSelect,
    ]
  );

  const contactsNeedingFix = contacts.filter((contact) => contact.needsFix);

  const renderEmptyState = useCallback(() => (
    <View style={styles.emptyContainer}>
      <Ionicons name="call-outline" size={48} color={textColor + "80"} />
      <ThemedText style={styles.emptyTitle}>No Contacts Need Fixing</ThemedText>
      <ThemedText style={styles.emptyText}>
        All your Rwandan contacts have both versions of their numbers (with and without country code).
      </ThemedText>
    </View>
  ), [textColor]);

  return (
    <View style={[styles.container, { backgroundColor, paddingTop: insets.top - 20 }]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <ThemedText style={styles.title}>Contacts</ThemedText>
          {contactsNeedingFix.length > 0 && !loadingStates.loadingContacts && (
            <View style={styles.selectionButtons}>
              {selectedContacts.size > 0 ? (
                <Pressable 
                  onPress={clearSelection}
                  disabled={loadingStates.fixingSelected}
                >
                  <ThemedText
                    style={[
                      styles.selectionButtonText,
                      { color: tintColor },
                      loadingStates.fixingSelected && styles.disabledText
                    ]}
                  >
                    Clear
                  </ThemedText>
                </Pressable>
              ) : (
                <Pressable onPress={selectAll}>
                  <ThemedText
                    style={[styles.selectionButtonText, { color: tintColor }]}
                  >
                    Select All
                  </ThemedText>
                </Pressable>
              )}
            </View>
          )}
        </View>
        {loadingStates.loadingContacts ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={tintColor} />
            <ThemedText style={styles.loadingText}>Loading contacts...</ThemedText>
          </View>
        ) : (
          contactsNeedingFix.length > 0 && (
            <ThemedText style={styles.subtitle}>
              {contactsNeedingFix.length} contacts need fixing
            </ThemedText>
          )
        )}
      </View>

      {selectedContacts.size > 0 && (
        <Pressable
          style={[
            styles.fixSelectedButton,
            loadingStates.fixingSelected && styles.disabledButton
          ]}
          onPress={handleFixSelected}
          disabled={loadingStates.fixingSelected}
        >
          {loadingStates.fixingSelected ? (
            <View style={styles.loadingButtonContent}>
              <ActivityIndicator size="small" color="white" />
              <ThemedText style={styles.fixSelectedText}>
                Fixing Contacts...
              </ThemedText>
            </View>
          ) : (
            <ThemedText style={styles.fixSelectedText}>
              Fix {selectedContacts.size} Selected Contacts
            </ThemedText>
          )}
        </Pressable>
      )}

      {!loadingStates.loadingContacts && contacts.length === 0 ? (
        renderEmptyState()
      ) : (
        <>
          {selectedContacts.size > 0 && (
            <View style={styles.tipContainer}>
              <ThemedText style={styles.tipText}>
                ℹ️ Selected contacts will have their numbers updated to include both formats:
                {"\n"}• 07XX → +25XX
                {"\n"}• +25XX → 07XX
              </ThemedText>
            </View>
          )}
          
          <View style={[styles.searchContainer, { backgroundColor, borderColor: tintColor + "30" }]}>
            <Ionicons name="search" size={20} color={textColor} />
            <TextInput
              style={[styles.searchInput, { color: textColor }]}
              placeholder="Search contacts..."
              placeholderTextColor={textColor + "80"}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          
          {contacts.length > 0 && (
            <View style={styles.tipContainer}>
              <ThemedText style={styles.tipText}>
                💡 Tap a contact to select it for bulk fixing
              </ThemedText>
            </View>
          )}

          <FlatList
            data={filteredContacts}
            renderItem={renderContact}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={loadingStates.loadingContacts} onRefresh={loadContacts} />}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    paddingBottom: 8,
  },
  title: {
    paddingTop: 20,
    fontSize: 34,
    fontWeight: "bold",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    margin: 16,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
  },
  contactItem: {
    flexDirection: "row",
    padding: 16,
    alignItems: "center",
    borderBottomWidth: 1,
  },
  avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
  },
  contactInfo: {
    flex: 1,
    marginLeft: 16,
  },
  contactName: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 4,
  },
  phoneNumbersContainer: {
    gap: 4,
  },
  phoneNumberRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  phoneLabel: {
    fontSize: 12,
    textTransform: "capitalize",
    opacity: 0.6,
    marginRight: 8,
    minWidth: 40,
  },
  phoneNumber: {
    fontSize: 14,
    opacity: 0.8,
  },
  needsFixContainer: {
    backgroundColor: "#ff6b6b15",
  },
  rwandanNumber: {
    color: "#007AFF",
  },
  fixButton: {
    marginTop: 8,
    padding: 8,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  fixButtonText: {
    color: "white",
    fontSize: 12,
    fontWeight: "500",
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.6,
    marginTop: 4,
  },
  selectedContainer: {
    backgroundColor: "#007AFF15",
  },
  fixSelectedButton: {
    margin: 16,
    marginTop: 0,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  fixSelectedText: {
    color: "white",
    fontSize: 16,
    fontWeight: "500",
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  selectionButtons: {
    flexDirection: "row",
    gap: 16,
  },
  selectionButtonText: {
    fontSize: 16,
    fontWeight: "500",
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    opacity: 0.7,
  },
  disabledButton: {
    opacity: 0.6,
  },
  disabledText: {
    opacity: 0.6,
  },
  loadingButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
  },
  tipContainer: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  tipText: {
    fontSize: 14,
    opacity: 0.7,
  },
});
