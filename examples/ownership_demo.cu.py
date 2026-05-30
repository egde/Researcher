from copperhead import own, borrow, mut


def consume(s: own[str]) -> str:
    return s.upper()


def inspect(s: borrow[str]) -> int:
    return len(s)


def modify(items: mut[list[int]]):
    items.append(42)


def main():
    name = "Alice"
    length = inspect(name)
    print(length)
    greeting = consume(name)
    print(greeting)
