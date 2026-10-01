#include <stdlib.h>
typedef struct { int time; } Twitter;
Twitter* Twitter_create(void) { return calloc(1,sizeof(Twitter)); }
void Twitter_postTweet(Twitter* self,int userId,int tweetId){(void)self;(void)userId;(void)tweetId;}
int* Twitter_getNewsFeed(Twitter* self,int userId,int* returnSize){(void)self;(void)userId;*returnSize=0;return NULL;}
void Twitter_follow(Twitter* self,int followerId,int followeeId){(void)self;(void)followerId;(void)followeeId;}
void Twitter_unfollow(Twitter* self,int followerId,int followeeId){(void)self;(void)followerId;(void)followeeId;}
