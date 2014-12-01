from django.db import models
from projects.models import Project
from django.contrib.auth.models import User

class Vis(models.Model):
    '''
    A Visualzaiton model
    '''
    project = models.ForeignKey(Project)
    user = models.ForeignKey(User)
    personIn = models.BooleanField(default = 0)
    locationIn = models.BooleanField(default = 0)
    phoneIn = models.BooleanField(default = 0)
    dateIn = models.BooleanField(default = 0)
    orgIn = models.BooleanField(default = 0)
    miscIn = models.BooleanField(default = 0)
    
class VisNodes(models.Model):
    '''
    Nodes that was selected on the vis
    '''
    vis = models.ForeignKey(Vis)
    nodeType = models.CharField(max_length=50)
    nodeId =  models.IntegerField() 
    
    