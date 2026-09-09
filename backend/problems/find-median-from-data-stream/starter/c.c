typedef struct {
    int _unused;
} MedianFinder;

MedianFinder* MedianFinder_create() {
    MedianFinder* obj = malloc(sizeof(MedianFinder));
    return obj;
}

void MedianFinder_addNum(MedianFinder* self, int num) {
}

double MedianFinder_findMedian(MedianFinder* self) {
    return 0.0;
}