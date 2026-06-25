
import heapq

def top_numbers(nums):
    return heapq.nlargest(3, nums)

top_numbers = top_numbers([5, 2, 8, 1, 9, 3, 7, 4, 6])
print(top_numbers)
