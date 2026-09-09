typedef struct {
    int _unused;
} Trie;

Trie* Trie_create() {
    Trie* obj = malloc(sizeof(Trie));
    return obj;
}

void Trie_insert(Trie* self, char* word) {
}

bool Trie_search(Trie* self, char* word) {
    return false;
}

bool Trie_startsWith(Trie* self, char* prefix) {
    return false;
}