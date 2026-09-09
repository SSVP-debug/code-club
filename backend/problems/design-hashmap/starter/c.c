typedef struct {
    int _unused;
} MyHashMap;

MyHashMap* MyHashMap_create() {
    MyHashMap* obj = malloc(sizeof(MyHashMap));
    return obj;
}

void MyHashMap_put(MyHashMap* self, int key, int value) {
}

int MyHashMap_get(MyHashMap* self, int key) {
    return -1;
}

void MyHashMap_remove(MyHashMap* self, int key) {
}