typedef struct {
    int _unused;
} StockSpanner;

StockSpanner* StockSpanner_create() {
    StockSpanner* obj = malloc(sizeof(StockSpanner));
    return obj;
}

int StockSpanner_next(StockSpanner* self, int price) {
    return 0;
}