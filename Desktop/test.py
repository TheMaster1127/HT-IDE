

# used the print func

# Convert value to integer
def INT(value):
    try:
        # Try converting the value to an integer
        return int(float(value))
    except ValueError:
        # If conversion fails, raise a TypeError
        raise TypeError("Cannot convert to integer")

# used imput func


#B:
#MsgBox, hi
#subout
#
#main
#gui pid:"gui1" x50% y50% w50% h50%
#gui pid:"gui1" fB button x50% y20%;
num = INT(input("how mnay loops: "))
for A_Index1 in range(0, num + 0):
    print(A_Index1)

