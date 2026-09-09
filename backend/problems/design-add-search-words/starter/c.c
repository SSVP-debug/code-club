typedef struct {
    int _unused;
} WordDictionary;

WordDictionary* WordDictionary_create() {
    WordDictionary* obj = malloc(sizeof(WordDictionary));
    return obj;
}

void WordDictionary_addWord(WordDictionary* self, char* word) {
}

bool WordDictionary_search(WordDictionary* self, char* word) {
    return false;
}