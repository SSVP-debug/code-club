typedef struct {
    int _unused;
} Trie;

Trie* Trie_create() {
    Trie* obj = malloc(sizeof(Trie));
    return obj;
}

void Trie_insert(Trie* self, char* word) {
}

int Trie_countWordsEqualTo(Trie* self, char* word) {
    return 0;
}

int Trie_countWordsStartingWith(Trie* self, char* prefix) {
    return 0;
}

void Trie_erase(Trie* self, char* word) {
}