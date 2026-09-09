typedef struct {
    int _unused;
} MapSum;

MapSum* MapSum_create() {
    MapSum* obj = malloc(sizeof(MapSum));
    return obj;
}

void MapSum_insert(MapSum* self, char* key, int val) {
}

int MapSum_sum(MapSum* self, char* prefix) {
    return 0;
}