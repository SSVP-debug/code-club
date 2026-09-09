typedef struct {
    int capacity;
} LRUCache;

LRUCache* LRUCache_create(int capacity) {
    LRUCache* obj = malloc(sizeof(LRUCache));
    obj->capacity = capacity;
    return obj;
}

int LRUCache_get(LRUCache* self, int key) {
    return -1;
}

void LRUCache_put(LRUCache* self, int key, int value) {
}