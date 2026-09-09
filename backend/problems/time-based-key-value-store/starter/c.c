typedef struct {
    int _unused;
} TimeMap;

TimeMap* TimeMap_create() {
    TimeMap* obj = malloc(sizeof(TimeMap));
    return obj;
}

void TimeMap_set(TimeMap* self, char* key, char* value, int timestamp) {
}

char* TimeMap_get(TimeMap* self, char* key, int timestamp) {
    return "";
}