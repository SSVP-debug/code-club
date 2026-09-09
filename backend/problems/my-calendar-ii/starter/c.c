typedef struct {
    int _unused;
} MyCalendarTwo;

MyCalendarTwo* MyCalendarTwo_create() {
    MyCalendarTwo* obj = malloc(sizeof(MyCalendarTwo));
    return obj;
}

bool MyCalendarTwo_book(MyCalendarTwo* self, int start, int end) {
    return false;
}